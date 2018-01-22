function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/*
 * id3 metadata track controller
*/

import Event from '../events';
import EventHandler from '../event-handler';
import ID3 from '../demux/id3';

var ID3TrackController = function (_EventHandler) {
  _inherits(ID3TrackController, _EventHandler);

  function ID3TrackController(hls) {
    _classCallCheck(this, ID3TrackController);

    var _this = _possibleConstructorReturn(this, _EventHandler.call(this, hls, Event.MEDIA_ATTACHED, Event.MEDIA_DETACHING, Event.FRAG_PARSING_METADATA));

    _this.id3Track = undefined;
    _this.media = undefined;
    return _this;
  }

  ID3TrackController.prototype.destroy = function destroy() {
    EventHandler.prototype.destroy.call(this);
  };

  // Add ID3 metatadata text track.


  ID3TrackController.prototype.onMediaAttached = function onMediaAttached(data) {
    this.media = data.media;
    if (!this.media) {
      return;
    }

    this.id3Track = this.media.addTextTrack('metadata', 'id3');
    this.id3Track.mode = 'hidden';
  };

  ID3TrackController.prototype.onMediaDetaching = function onMediaDetaching() {
    this.media = undefined;
  };

  ID3TrackController.prototype.onFragParsingMetadata = function onFragParsingMetadata(data) {
    var fragment = data.frag;
    var samples = data.samples;

    // Attempt to recreate Safari functionality by creating
    // WebKitDataCue objects when available and store the decoded
    // ID3 data in the value property of the cue
    var Cue = window.WebKitDataCue || window.VTTCue || window.TextTrackCue;

    for (var i = 0; i < samples.length; i++) {
      var frames = ID3.getID3Frames(samples[i].data);
      if (frames) {
        var startTime = samples[i].pts;
        var endTime = i < samples.length - 1 ? samples[i + 1].pts : fragment.endPTS;

        // Give a slight bump to the endTime if it's equal to startTime to avoid a SyntaxError in IE
        if (startTime === endTime) {
          endTime += 0.0001;
        }

        for (var j = 0; j < frames.length; j++) {
          var frame = frames[j];
          // Safari doesn't put the timestamp frame in the TextTrack
          if (!ID3.isTimeStampFrame(frame)) {
            var cue = new Cue(startTime, endTime, '');
            cue.value = frame;
            this.id3Track.addCue(cue);
          }
        }
      }
    }
  };

  return ID3TrackController;
}(EventHandler);

export default ID3TrackController;