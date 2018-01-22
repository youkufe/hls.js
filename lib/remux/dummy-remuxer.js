function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * dummy remuxer
*/

var DummyRemuxer = function () {
  function DummyRemuxer(observer) {
    _classCallCheck(this, DummyRemuxer);

    this.observer = observer;
  }

  DummyRemuxer.prototype.destroy = function destroy() {};

  DummyRemuxer.prototype.resetInitSegment = function resetInitSegment() {};

  DummyRemuxer.prototype.resetTimeStamp = function resetTimeStamp() {};

  DummyRemuxer.prototype.remux = function remux(audioTrack, videoTrack, id3Track, textTrack, timeOffset) {
    this._remuxAACSamples(audioTrack, timeOffset);
    this._remuxAVCSamples(videoTrack, timeOffset);
    this._remuxID3Samples(id3Track, timeOffset);
    this._remuxTextSamples(textTrack, timeOffset);
  };

  DummyRemuxer.prototype._remuxAVCSamples = function _remuxAVCSamples(track, timeOffset) {
    var avcSample, unit;
    // loop through track.samples
    while (track.samples.length) {
      avcSample = track.samples.shift();
      // loop through AVC sample NALUs
      while (avcSample.units.length) {
        unit = avcSample.units.shift();
      }
    }
    //please lint
    timeOffset = timeOffset;
  };

  DummyRemuxer.prototype._remuxAACSamples = function _remuxAACSamples(track, timeOffset) {
    var aacSample, unit;
    // loop through track.samples
    while (track.samples.length) {
      aacSample = track.samples.shift();
      unit = aacSample.unit;
    }
    //please lint
    timeOffset = timeOffset;
  };

  DummyRemuxer.prototype._remuxID3Samples = function _remuxID3Samples(track, timeOffset) {
    var id3Sample, unit;
    // loop through track.samples
    while (track.samples.length) {
      id3Sample = track.samples.shift();
      unit = id3Sample.unit;
    }
    //please lint
    timeOffset = timeOffset;
  };

  DummyRemuxer.prototype._remuxTextSamples = function _remuxTextSamples(track, timeOffset) {
    var textSample, bytes;
    // loop through track.samples
    while (track.samples.length) {
      textSample = track.samples.shift();
      bytes = textSample.bytes;
    }
    //please lint
    timeOffset = timeOffset;
  };

  return DummyRemuxer;
}();

export default DummyRemuxer;