function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/*
 * Subtitle Stream Controller
*/

import Event from '../events';
import EventHandler from '../event-handler';
import { logger } from '../utils/logger';

var SubtitleStreamController = function (_EventHandler) {
  _inherits(SubtitleStreamController, _EventHandler);

  function SubtitleStreamController(hls) {
    _classCallCheck(this, SubtitleStreamController);

    var _this = _possibleConstructorReturn(this, _EventHandler.call(this, hls, Event.ERROR, Event.SUBTITLE_TRACKS_UPDATED, Event.SUBTITLE_TRACK_SWITCH, Event.SUBTITLE_TRACK_LOADED, Event.SUBTITLE_FRAG_PROCESSED));

    _this.config = hls.config;
    _this.vttFragSNsProcessed = {};
    _this.vttFragQueues = undefined;
    _this.currentlyProcessing = null;
    _this.currentTrackId = -1;
    return _this;
  }

  SubtitleStreamController.prototype.destroy = function destroy() {
    EventHandler.prototype.destroy.call(this);
  };

  // Remove all queued items and create a new, empty queue for each track.


  SubtitleStreamController.prototype.clearVttFragQueues = function clearVttFragQueues() {
    var _this2 = this;

    this.vttFragQueues = {};
    this.tracks.forEach(function (track) {
      _this2.vttFragQueues[track.id] = [];
    });
  };

  // If no frag is being processed and queue isn't empty, initiate processing of next frag in line.


  SubtitleStreamController.prototype.nextFrag = function nextFrag() {
    if (this.currentlyProcessing === null && this.currentTrackId > -1 && this.vttFragQueues[this.currentTrackId].length) {
      var frag = this.currentlyProcessing = this.vttFragQueues[this.currentTrackId].shift();
      this.hls.trigger(Event.FRAG_LOADING, { frag: frag });
    }
  };

  // When fragment has finished processing, add sn to list of completed if successful.


  SubtitleStreamController.prototype.onSubtitleFragProcessed = function onSubtitleFragProcessed(data) {
    if (data.success) {
      this.vttFragSNsProcessed[data.frag.trackId].push(data.frag.sn);
    }
    this.currentlyProcessing = null;
    this.nextFrag();
  };

  // If something goes wrong, procede to next frag, if we were processing one.


  SubtitleStreamController.prototype.onError = function onError(data) {
    var frag = data.frag;
    // don't handle frag error not related to subtitle fragment
    if (frag && frag.type !== 'subtitle') {
      return;
    }
    if (this.currentlyProcessing) {
      this.currentlyProcessing = null;
      this.nextFrag();
    }
  };

  // Got all new subtitle tracks.


  SubtitleStreamController.prototype.onSubtitleTracksUpdated = function onSubtitleTracksUpdated(data) {
    var _this3 = this;

    logger.log('subtitle tracks updated');
    this.tracks = data.subtitleTracks;
    this.clearVttFragQueues();
    this.vttFragSNsProcessed = {};
    this.tracks.forEach(function (track) {
      _this3.vttFragSNsProcessed[track.id] = [];
    });
  };

  SubtitleStreamController.prototype.onSubtitleTrackSwitch = function onSubtitleTrackSwitch(data) {
    this.currentTrackId = data.id;
    this.clearVttFragQueues();
  };

  // Got a new set of subtitle fragments.


  SubtitleStreamController.prototype.onSubtitleTrackLoaded = function onSubtitleTrackLoaded(data) {
    var processedFragSNs = this.vttFragSNsProcessed[data.id],
        fragQueue = this.vttFragQueues[data.id],
        currentFragSN = !!this.currentlyProcessing ? this.currentlyProcessing.sn : -1;

    var alreadyProcessed = function alreadyProcessed(frag) {
      return processedFragSNs.indexOf(frag.sn) > -1;
    };

    var alreadyInQueue = function alreadyInQueue(frag) {
      return fragQueue.some(function (fragInQueue) {
        return fragInQueue.sn === frag.sn;
      });
    };

    // Add all fragments that haven't been, aren't currently being and aren't waiting to be processed, to queue.
    data.details.fragments.forEach(function (frag) {
      if (!(alreadyProcessed(frag) || frag.sn === currentFragSN || alreadyInQueue(frag))) {
        // Frags don't know their subtitle track ID, so let's just add that...
        frag.trackId = data.id;
        fragQueue.push(frag);
      }
    });

    this.nextFrag();
  };

  return SubtitleStreamController;
}(EventHandler);

export default SubtitleStreamController;