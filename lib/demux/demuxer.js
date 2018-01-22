function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

import Event from '../events';
import DemuxerInline from '../demux/demuxer-inline';
import DemuxerWorker from '../demux/demuxer-worker';
import { logger } from '../utils/logger';
import { ErrorTypes, ErrorDetails } from '../errors';
import EventEmitter from 'events';

var Demuxer = function () {
  function Demuxer(hls, id) {
    _classCallCheck(this, Demuxer);

    this.hls = hls;
    this.id = id;
    // observer setup
    var observer = this.observer = new EventEmitter();
    var config = hls.config;
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

    var forwardMessage = function (ev, data) {
      data = data || {};
      data.frag = this.frag;
      data.id = this.id;
      hls.trigger(ev, data);
    }.bind(this);

    // forward events to main thread
    observer.on(Event.FRAG_DECRYPTED, forwardMessage);
    observer.on(Event.FRAG_PARSING_INIT_SEGMENT, forwardMessage);
    observer.on(Event.FRAG_PARSING_DATA, forwardMessage);
    observer.on(Event.FRAG_PARSED, forwardMessage);
    observer.on(Event.ERROR, forwardMessage);
    observer.on(Event.FRAG_PARSING_METADATA, forwardMessage);
    observer.on(Event.FRAG_PARSING_USERDATA, forwardMessage);
    observer.on(Event.INIT_PTS_FOUND, forwardMessage);

    var typeSupported = {
      mp4: MediaSource.isTypeSupported('video/mp4'),
      mpeg: MediaSource.isTypeSupported('audio/mpeg'),
      mp3: MediaSource.isTypeSupported('audio/mp4; codecs="mp3"')
    };
    // navigator.vendor is not always available in Web Worker
    // refer to https://developer.mozilla.org/en-US/docs/Web/API/WorkerGlobalScope/navigator
    var vendor = navigator.vendor;
    if (config.enableWorker && typeof Worker !== 'undefined') {
      logger.log('demuxing in webworker');
      var w = void 0;
      try {
        var work = require('webworkify');
        w = this.w = work(DemuxerWorker);
        this.onwmsg = this.onWorkerMessage.bind(this);
        w.addEventListener('message', this.onwmsg);
        w.onerror = function (event) {
          hls.trigger(Event.ERROR, { type: ErrorTypes.OTHER_ERROR, details: ErrorDetails.INTERNAL_EXCEPTION, fatal: true, event: 'demuxerWorker', err: { message: event.message + ' (' + event.filename + ':' + event.lineno + ')' } });
        };
        w.postMessage({ cmd: 'init', typeSupported: typeSupported, vendor: vendor, id: id, config: JSON.stringify(config) });
      } catch (err) {
        logger.error('error while initializing DemuxerWorker, fallback on DemuxerInline');
        if (w) {
          // revoke the Object URL that was used to create demuxer worker, so as not to leak it
          URL.revokeObjectURL(w.objectURL);
        }
        this.demuxer = new DemuxerInline(observer, typeSupported, config, vendor);
        this.w = undefined;
      }
    } else {
      this.demuxer = new DemuxerInline(observer, typeSupported, config, vendor);
    }
  }

  Demuxer.prototype.destroy = function destroy() {
    var w = this.w;
    if (w) {
      w.removeEventListener('message', this.onwmsg);
      w.terminate();
      this.w = null;
    } else {
      var demuxer = this.demuxer;
      if (demuxer) {
        demuxer.destroy();
        this.demuxer = null;
      }
    }
    var observer = this.observer;
    if (observer) {
      observer.removeAllListeners();
      this.observer = null;
    }
  };

  Demuxer.prototype.push = function push(data, initSegment, audioCodec, videoCodec, frag, duration, accurateTimeOffset, defaultInitPTS) {
    var w = this.w;
    var timeOffset = !isNaN(frag.startDTS) ? frag.startDTS : frag.start;
    var decryptdata = frag.decryptdata;
    var lastFrag = this.frag;
    var discontinuity = !(lastFrag && frag.cc === lastFrag.cc);
    var trackSwitch = !(lastFrag && frag.level === lastFrag.level);
    var nextSN = lastFrag && frag.sn === lastFrag.sn + 1;
    var contiguous = !trackSwitch && nextSN;
    if (discontinuity) {
      logger.log(this.id + ':discontinuity detected');
    }
    if (trackSwitch) {
      logger.log(this.id + ':switch detected');
    }
    this.frag = frag;
    if (w) {
      // post fragment payload as transferable objects (no copy)
      w.postMessage({ cmd: 'demux', data: data, decryptdata: decryptdata, initSegment: initSegment, audioCodec: audioCodec, videoCodec: videoCodec, timeOffset: timeOffset, discontinuity: discontinuity, trackSwitch: trackSwitch, contiguous: contiguous, duration: duration, accurateTimeOffset: accurateTimeOffset, defaultInitPTS: defaultInitPTS }, [data]);
    } else {
      var demuxer = this.demuxer;
      if (demuxer) {
        demuxer.push(data, decryptdata, initSegment, audioCodec, videoCodec, timeOffset, discontinuity, trackSwitch, contiguous, duration, accurateTimeOffset, defaultInitPTS);
      }
    }
  };

  Demuxer.prototype.onWorkerMessage = function onWorkerMessage(ev) {
    var data = ev.data,
        hls = this.hls;
    //console.log('onWorkerMessage:' + data.event);
    switch (data.event) {
      case 'init':
        // revoke the Object URL that was used to create demuxer worker, so as not to leak it
        URL.revokeObjectURL(this.w.objectURL);
        break;
      // special case for FRAG_PARSING_DATA: data1 and data2 are transferable objects
      case Event.FRAG_PARSING_DATA:
        data.data.data1 = new Uint8Array(data.data1);
        if (data.data2) {
          data.data.data2 = new Uint8Array(data.data2);
        }
      /* falls through */
      default:
        data.data = data.data || {};
        data.data.frag = this.frag;
        data.data.id = this.id;
        hls.trigger(data.event, data.data);
        break;
    }
  };

  return Demuxer;
}();

export default Demuxer;