function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/*  inline demuxer.
 *   probe fragments and instantiate appropriate demuxer depending on content type (TSDemuxer, AACDemuxer, ...)
 */

import Event from '../events';
import { ErrorTypes, ErrorDetails } from '../errors';
import Decrypter from '../crypt/decrypter';
import AACDemuxer from '../demux/aacdemuxer';
import MP4Demuxer from '../demux/mp4demuxer';
import TSDemuxer from '../demux/tsdemuxer';
import MP3Demuxer from '../demux/mp3demuxer';
import MP4Remuxer from '../remux/mp4-remuxer';
import PassThroughRemuxer from '../remux/passthrough-remuxer';

var DemuxerInline = function () {
  function DemuxerInline(observer, typeSupported, config, vendor) {
    _classCallCheck(this, DemuxerInline);

    this.observer = observer;
    this.typeSupported = typeSupported;
    this.config = config;
    this.vendor = vendor;
  }

  DemuxerInline.prototype.destroy = function destroy() {
    var demuxer = this.demuxer;
    if (demuxer) {
      demuxer.destroy();
    }
  };

  DemuxerInline.prototype.push = function push(data, decryptdata, initSegment, audioCodec, videoCodec, timeOffset, discontinuity, trackSwitch, contiguous, duration, accurateTimeOffset, defaultInitPTS) {
    if (data.byteLength > 0 && decryptdata != null && decryptdata.key != null && decryptdata.method === 'AES-128') {
      var decrypter = this.decrypter;
      if (decrypter == null) {
        decrypter = this.decrypter = new Decrypter(this.observer, this.config);
      }
      var localthis = this;
      // performance.now() not available on WebWorker, at least on Safari Desktop
      var startTime;
      try {
        startTime = performance.now();
      } catch (error) {
        startTime = Date.now();
      }
      decrypter.decrypt(data, decryptdata.key.buffer, decryptdata.iv.buffer, function (decryptedData) {
        var endTime;
        try {
          endTime = performance.now();
        } catch (error) {
          endTime = Date.now();
        }
        localthis.observer.trigger(Event.FRAG_DECRYPTED, { stats: { tstart: startTime, tdecrypt: endTime } });
        localthis.pushDecrypted(new Uint8Array(decryptedData), decryptdata, new Uint8Array(initSegment), audioCodec, videoCodec, timeOffset, discontinuity, trackSwitch, contiguous, duration, accurateTimeOffset, defaultInitPTS);
      });
    } else {
      this.pushDecrypted(new Uint8Array(data), decryptdata, new Uint8Array(initSegment), audioCodec, videoCodec, timeOffset, discontinuity, trackSwitch, contiguous, duration, accurateTimeOffset, defaultInitPTS);
    }
  };

  DemuxerInline.prototype.pushDecrypted = function pushDecrypted(data, decryptdata, initSegment, audioCodec, videoCodec, timeOffset, discontinuity, trackSwitch, contiguous, duration, accurateTimeOffset, defaultInitPTS) {
    var demuxer = this.demuxer;
    if (!demuxer ||
    // in case of continuity change, we might switch from content type (AAC container to TS container for example)
    // so let's check that current demuxer is still valid
    discontinuity && !this.probe(data)) {
      var observer = this.observer;
      var typeSupported = this.typeSupported;
      var config = this.config;
      // probing order is AAC/MP3/TS/MP4
      var muxConfig = [{ demux: AACDemuxer, remux: MP4Remuxer }, { demux: MP3Demuxer, remux: MP4Remuxer }, { demux: TSDemuxer, remux: MP4Remuxer }, { demux: MP4Demuxer, remux: PassThroughRemuxer }];

      // probe for content type
      for (var i = 0, len = muxConfig.length; i < len; i++) {
        var mux = muxConfig[i];
        var probe = mux.demux.probe;
        if (probe(data)) {
          var _remuxer = this.remuxer = new mux.remux(observer, config, typeSupported, this.vendor);
          demuxer = new mux.demux(observer, _remuxer, config, typeSupported);
          this.probe = probe;
          break;
        }
      }
      if (!demuxer) {
        observer.trigger(Event.ERROR, { type: ErrorTypes.MEDIA_ERROR, details: ErrorDetails.FRAG_PARSING_ERROR, fatal: true, reason: 'no demux matching with content found' });
        return;
      }
      this.demuxer = demuxer;
    }
    var remuxer = this.remuxer;

    if (discontinuity || trackSwitch) {
      demuxer.resetInitSegment(initSegment, audioCodec, videoCodec, duration);
      remuxer.resetInitSegment();
    }
    if (discontinuity) {
      demuxer.resetTimeStamp(defaultInitPTS);
      remuxer.resetTimeStamp(defaultInitPTS);
    }
    if (typeof demuxer.setDecryptData === 'function') {
      demuxer.setDecryptData(decryptdata);
    }
    demuxer.append(data, timeOffset, contiguous, accurateTimeOffset);
  };

  return DemuxerInline;
}();

export default DemuxerInline;