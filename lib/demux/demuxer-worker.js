/* demuxer web worker.
 *  - listen to worker message, and trigger DemuxerInline upon reception of Fragments.
 *  - provides MP4 Boxes back to main thread using [transferable objects](https://developers.google.com/web/updates/2011/12/Transferable-Objects-Lightning-Fast) in order to minimize message passing overhead.
 */

import DemuxerInline from '../demux/demuxer-inline';
import Event from '../events';
import { enableLogs } from '../utils/logger';
import EventEmitter from 'events';

var DemuxerWorker = function DemuxerWorker(self) {
  // observer setup
  var observer = new EventEmitter();
  observer.trigger = function trigger(event) {
    for (var _len = arguments.length, data = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      data[_key - 1] = arguments[_key];
    }

    observer.emit.apply(observer, [event, event].concat(data));
  };

  observer.off = function off(event) {
    for (var _len2 = arguments.length, data = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
      data[_key2 - 1] = arguments[_key2];
    }

    observer.removeListener.apply(observer, [event].concat(data));
  };

  var forwardMessage = function forwardMessage(ev, data) {
    self.postMessage({ event: ev, data: data });
  };

  self.addEventListener('message', function (ev) {
    var data = ev.data;
    //console.log('demuxer cmd:' + data.cmd);
    switch (data.cmd) {
      case 'init':
        var config = JSON.parse(data.config);
        self.demuxer = new DemuxerInline(observer, data.typeSupported, config, data.vendor);
        try {
          enableLogs(config.debug === true);
        } catch (err) {
          console.warn('demuxerWorker: unable to enable logs');
        }
        // signal end of worker init
        forwardMessage('init', null);
        break;
      case 'demux':
        self.demuxer.push(data.data, data.decryptdata, data.initSegment, data.audioCodec, data.videoCodec, data.timeOffset, data.discontinuity, data.trackSwitch, data.contiguous, data.duration, data.accurateTimeOffset, data.defaultInitPTS);
        break;
      default:
        break;
    }
  });

  // forward events to main thread
  observer.on(Event.FRAG_DECRYPTED, forwardMessage);
  observer.on(Event.FRAG_PARSING_INIT_SEGMENT, forwardMessage);
  observer.on(Event.FRAG_PARSED, forwardMessage);
  observer.on(Event.ERROR, forwardMessage);
  observer.on(Event.FRAG_PARSING_METADATA, forwardMessage);
  observer.on(Event.FRAG_PARSING_USERDATA, forwardMessage);
  observer.on(Event.INIT_PTS_FOUND, forwardMessage);

  // special case for FRAG_PARSING_DATA: pass data1/data2 as transferable object (no copy)
  observer.on(Event.FRAG_PARSING_DATA, function (ev, data) {
    var transferable = [];
    var message = { event: ev, data: data };
    if (data.data1) {
      message.data1 = data.data1.buffer;
      transferable.push(data.data1.buffer);
      delete data.data1;
    }
    if (data.data2) {
      message.data2 = data.data2.buffer;
      transferable.push(data.data2.buffer);
      delete data.data2;
    }
    self.postMessage(message, transferable);
  });
};

export default DemuxerWorker;