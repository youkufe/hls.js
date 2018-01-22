var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/*
 * audio track controller
*/

import Event from '../events';
import EventHandler from '../event-handler';
import { logger } from '../utils/logger';
import { ErrorTypes } from '../errors';

var AudioTrackController = function (_EventHandler) {
  _inherits(AudioTrackController, _EventHandler);

  function AudioTrackController(hls) {
    _classCallCheck(this, AudioTrackController);

    var _this = _possibleConstructorReturn(this, _EventHandler.call(this, hls, Event.MANIFEST_LOADING, Event.MANIFEST_LOADED, Event.AUDIO_TRACK_LOADED, Event.ERROR));

    _this.ticks = 0;
    _this.ontick = _this.tick.bind(_this);
    return _this;
  }

  AudioTrackController.prototype.destroy = function destroy() {
    this.cleanTimer();
    EventHandler.prototype.destroy.call(this);
  };

  AudioTrackController.prototype.cleanTimer = function cleanTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  };

  AudioTrackController.prototype.tick = function tick() {
    this.ticks++;
    if (this.ticks === 1) {
      this.doTick();
      if (this.ticks > 1) {
        setTimeout(this.tick, 1);
      }
      this.ticks = 0;
    }
  };

  AudioTrackController.prototype.doTick = function doTick() {
    this.updateTrack(this.trackId);
  };

  AudioTrackController.prototype.onError = function onError(data) {
    if (data.fatal && data.type === ErrorTypes.NETWORK_ERROR) {
      this.cleanTimer();
    }
  };

  AudioTrackController.prototype.onManifestLoading = function onManifestLoading() {
    // reset audio tracks on manifest loading
    this.tracks = [];
    this.trackId = -1;
  };

  AudioTrackController.prototype.onManifestLoaded = function onManifestLoaded(data) {
    var _this2 = this;

    var tracks = data.audioTracks || [];
    var defaultFound = false;
    this.tracks = tracks;
    this.hls.trigger(Event.AUDIO_TRACKS_UPDATED, { audioTracks: tracks });
    // loop through available audio tracks and autoselect default if needed
    var id = 0;
    tracks.forEach(function (track) {
      if (track.default && !defaultFound) {
        _this2.audioTrack = id;
        defaultFound = true;
        return;
      }
      id++;
    });
    if (defaultFound === false && tracks.length) {
      logger.log('no default audio track defined, use first audio track as default');
      this.audioTrack = 0;
    }
  };

  AudioTrackController.prototype.onAudioTrackLoaded = function onAudioTrackLoaded(data) {
    if (data.id < this.tracks.length) {
      logger.log('audioTrack ' + data.id + ' loaded');
      this.tracks[data.id].details = data.details;
      // check if current playlist is a live playlist
      if (data.details.live && !this.timer) {
        // if live playlist we will have to reload it periodically
        // set reload period to playlist target duration
        this.timer = setInterval(this.ontick, 1000 * data.details.targetduration);
      }
      if (!data.details.live && this.timer) {
        // playlist is not live and timer is armed : stopping it
        this.cleanTimer();
      }
    }
  };

  /** get alternate audio tracks list from playlist **/


  AudioTrackController.prototype.setAudioTrackInternal = function setAudioTrackInternal(newId) {
    // check if level idx is valid
    if (newId >= 0 && newId < this.tracks.length) {
      // stopping live reloading timer if any
      this.cleanTimer();
      this.trackId = newId;
      logger.log('switching to audioTrack ' + newId);
      var audioTrack = this.tracks[newId],
          hls = this.hls,
          type = audioTrack.type,
          url = audioTrack.url,
          eventObj = { id: newId, type: type, url: url };
      // keep AUDIO_TRACK_SWITCH for legacy reason
      hls.trigger(Event.AUDIO_TRACK_SWITCH, eventObj);
      hls.trigger(Event.AUDIO_TRACK_SWITCHING, eventObj);
      // check if we need to load playlist for this audio Track
      var details = audioTrack.details;
      if (url && (details === undefined || details.live === true)) {
        // track not retrieved yet, or live playlist we need to (re)load it
        logger.log('(re)loading playlist for audioTrack ' + newId);
        hls.trigger(Event.AUDIO_TRACK_LOADING, { url: url, id: newId });
      }
    }
  };

  AudioTrackController.prototype.updateTrack = function updateTrack(newId) {
    // check if level idx is valid
    if (newId >= 0 && newId < this.tracks.length) {
      // stopping live reloading timer if any
      this.cleanTimer();
      this.trackId = newId;
      logger.log('updating audioTrack ' + newId);
      var audioTrack = this.tracks[newId],
          url = audioTrack.url;
      // check if we need to load playlist for this audio Track
      var details = audioTrack.details;
      if (url && (details === undefined || details.live === true)) {
        // track not retrieved yet, or live playlist we need to (re)load it
        logger.log('(re)loading playlist for audioTrack ' + newId);
        this.hls.trigger(Event.AUDIO_TRACK_LOADING, { url: url, id: newId });
      }
    }
  };

  _createClass(AudioTrackController, [{
    key: 'audioTracks',
    get: function get() {
      return this.tracks;
    }

    /** get index of the selected audio track (index in audio track lists) **/

  }, {
    key: 'audioTrack',
    get: function get() {
      return this.trackId;
    }

    /** select an audio track, based on its index in audio track lists**/
    ,
    set: function set(audioTrackId) {
      if (this.trackId !== audioTrackId || this.tracks[audioTrackId].details === undefined) {
        this.setAudioTrackInternal(audioTrackId);
      }
    }
  }]);

  return AudioTrackController;
}(EventHandler);

export default AudioTrackController;