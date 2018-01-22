function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * AAC demuxer
 */
import ADTS from './adts';
import { logger } from '../utils/logger';
import ID3 from '../demux/id3';

var AACDemuxer = function () {
  function AACDemuxer(observer, remuxer, config) {
    _classCallCheck(this, AACDemuxer);

    this.observer = observer;
    this.config = config;
    this.remuxer = remuxer;
  }

  AACDemuxer.prototype.resetInitSegment = function resetInitSegment(initSegment, audioCodec, videoCodec, duration) {
    this._audioTrack = { container: 'audio/adts', type: 'audio', id: -1, sequenceNumber: 0, isAAC: true, samples: [], len: 0, manifestCodec: audioCodec, duration: duration, inputTimeScale: 90000 };
  };

  AACDemuxer.prototype.resetTimeStamp = function resetTimeStamp() {};

  AACDemuxer.probe = function probe(data) {
    // check if data contains ID3 timestamp and ADTS sync word
    var offset, length;
    var id3Data = ID3.getID3Data(data, 0);
    if (id3Data && ID3.getTimeStamp(id3Data) !== undefined) {
      // Look for ADTS header | 1111 1111 | 1111 X00X | where X can be either 0 or 1
      // Layer bits (position 14 and 15) in header should be always 0 for ADTS
      // More info https://wiki.multimedia.cx/index.php?title=ADTS
      for (offset = id3Data.length, length = Math.min(data.length - 1, offset + 100); offset < length; offset++) {
        if (ADTS.probe(data, offset)) {
          logger.log('ADTS sync word found !');
          return true;
        }
      }
    }
    return false;
  };

  // feed incoming data to the front of the parsing pipeline


  AACDemuxer.prototype.append = function append(data, timeOffset, contiguous, accurateTimeOffset) {
    var track = this._audioTrack,
        id3Data = ID3.getID3Data(data, 0),
        pts = 90 * ID3.getTimeStamp(id3Data),
        frameIndex = 0,
        stamp = pts,
        length = data.length,
        offset = id3Data.length;

    var id3Samples = [{ pts: stamp, dts: stamp, data: id3Data }];

    while (offset < length - 1) {
      if (ADTS.isHeader(data, offset) && offset + 5 < length) {
        ADTS.initTrackConfig(track, this.observer, data, offset, track.manifestCodec);
        var frame = ADTS.appendFrame(track, data, offset, pts, frameIndex);
        if (frame) {
          offset += frame.length;
          stamp = frame.sample.pts;
          frameIndex++;
        } else {
          logger.log('Unable to parse AAC frame');
          break;
        }
      } else if (ID3.isHeader(data, offset)) {
        id3Data = ID3.getID3Data(data, offset);
        id3Samples.push({ pts: stamp, dts: stamp, data: id3Data });
        offset += id3Data.length;
      } else {
        //nothing found, keep looking
        offset++;
      }
    }

    this.remuxer.remux(track, { samples: [] }, { samples: id3Samples, inputTimeScale: 90000 }, { samples: [] }, timeOffset, contiguous, accurateTimeOffset);
  };

  AACDemuxer.prototype.destroy = function destroy() {};

  return AACDemuxer;
}();

export default AACDemuxer;