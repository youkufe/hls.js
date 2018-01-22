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

function filterSubtitleTracks(textTrackList) {
  var tracks = [];
  for (var i = 0; i < textTrackList.length; i++) {
    if (textTrackList[i].kind === 'subtitles') {
      tracks.push(textTrackList[i]);
    }
  }
  return tracks;
}

var SubtitleTrackController = function (_EventHandler) {
  _inherits(SubtitleTrackController, _EventHandler);

  function SubtitleTrackController(hls) {
    _classCallCheck(this, SubtitleTrackController);

    var _this = _possibleConstructorReturn(this, _EventHandler.call(this, hls, Event.MEDIA_ATTACHED, Event.MEDIA_DETACHING, Event.MANIFEST_LOADING, Event.MANIFEST_LOADED, Event.SUBTITLE_TRACK_LOADED));

    _this.tracks = [];
    _this.trackId = -1;
    _this.media = undefined;
    return _this;
  }

  SubtitleTrackController.prototype._onTextTracksChanged = function _onTextTracksChanged() {
    // Media is undefined when switching streams via loadSource()
    if (!this.media) {
      return;
    }

    var trackId = -1;
    var tracks = filterSubtitleTracks(this.media.textTracks);
    for (var id = 0; id < tracks.length; id++) {
      if (tracks[id].mode === 'showing') {
        trackId = id;
      }
    }

    // Setting current subtitleTrack will invoke code.
    this.subtitleTrack = trackId;
  };

  SubtitleTrackController.prototype.destroy = function destroy() {
    EventHandler.prototype.destroy.call(this);
  };

  // Listen for subtitle track change, then extract the current track ID.


  SubtitleTrackController.prototype.onMediaAttached = function onMediaAttached(data) {
    this.media = data.media;
    if (!this.media) {
      return;
    }

    this.trackChangeListener = this._onTextTracksChanged.bind(this);
    this.media.textTracks.addEventListener('change', this.trackChangeListener);
  };

  SubtitleTrackController.prototype.onMediaDetaching = function onMediaDetaching() {
    if (!this.media) {
      return;
    }

    this.media.textTracks.removeEventListener('change', this.trackChangeListener);

    this.media = undefined;
  };

  // Reset subtitle tracks on manifest loading


  SubtitleTrackController.prototype.onManifestLoading = function onManifestLoading() {
    this.tracks = [];
    this.trackId = -1;
  };

  // Fired whenever a new manifest is loaded.


  SubtitleTrackController.prototype.onManifestLoaded = function onManifestLoaded(data) {
    var _this2 = this;

    var tracks = data.subtitles || [];
    var defaultFound = false;
    this.tracks = tracks;
    this.trackId = -1;
    this.hls.trigger(Event.SUBTITLE_TRACKS_UPDATED, { subtitleTracks: tracks });

    // loop through available subtitle tracks and autoselect default if needed
    // TODO: improve selection logic to handle forced, etc
    tracks.forEach(function (track) {
      if (track.default) {
        _this2.subtitleTrack = track.id;
        defaultFound = true;
      }
    });
  };

  // Trigger subtitle track playlist reload.


  SubtitleTrackController.prototype.onTick = function onTick() {
    var trackId = this.trackId;
    var subtitleTrack = this.tracks[trackId];
    if (!subtitleTrack) {
      return;
    }

    var details = subtitleTrack.details;
    // check if we need to load playlist for this subtitle Track
    if (details === undefined || details.live === true) {
      // track not retrieved yet, or live playlist we need to (re)load it
      logger.log('(re)loading playlist for subtitle track ' + trackId);
      this.hls.trigger(Event.SUBTITLE_TRACK_LOADING, { url: subtitleTrack.url, id: trackId });
    }
  };

  SubtitleTrackController.prototype.onSubtitleTrackLoaded = function onSubtitleTrackLoaded(data) {
    var _this3 = this;

    if (data.id < this.tracks.length) {
      logger.log('subtitle track ' + data.id + ' loaded');
      this.tracks[data.id].details = data.details;
      // check if current playlist is a live playlist
      if (data.details.live && !this.timer) {
        // if live playlist we will have to reload it periodically
        // set reload period to playlist target duration
        this.timer = setInterval(function () {
          _this3.onTick();
        }, 1000 * data.details.targetduration, this);
      }
      if (!data.details.live && this.timer) {
        // playlist is not live and timer is armed : stopping it
        clearInterval(this.timer);
        this.timer = null;
      }
    }
  };

  /** get alternate subtitle tracks list from playlist **/


  SubtitleTrackController.prototype.setSubtitleTrackInternal = function setSubtitleTrackInternal(newId) {
    // check if level idx is valid
    if (newId >= 0 && newId < this.tracks.length) {
      // stopping live reloading timer if any
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
      this.trackId = newId;
      logger.log('switching to subtitle track ' + newId);
      var subtitleTrack = this.tracks[newId];
      this.hls.trigger(Event.SUBTITLE_TRACK_SWITCH, { id: newId });
      // check if we need to load playlist for this subtitle Track
      var details = subtitleTrack.details;
      if (details === undefined || details.live === true) {
        // track not retrieved yet, or live playlist we need to (re)load it
        logger.log('(re)loading playlist for subtitle track ' + newId);
        this.hls.trigger(Event.SUBTITLE_TRACK_LOADING, { url: subtitleTrack.url, id: newId });
      }
    }
  };

  _createClass(SubtitleTrackController, [{
    key: 'subtitleTracks',
    get: function get() {
      return this.tracks;
    }

    /** get index of the selected subtitle track (index in subtitle track lists) **/

  }, {
    key: 'subtitleTrack',
    get: function get() {
      return this.trackId;
    }

    /** select a subtitle track, based on its index in subtitle track lists**/
    ,
    set: function set(subtitleTrackId) {
      if (this.trackId !== subtitleTrackId) {
        // || this.tracks[subtitleTrackId].details === undefined) {
        this.setSubtitleTrackInternal(subtitleTrackId);
      }
    }
  }]);

  return SubtitleTrackController;
}(EventHandler);

export default SubtitleTrackController;