var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Playlist Loader
*/

import URLToolkit from 'url-toolkit';
import Event from '../events';
import EventHandler from '../event-handler';
import { ErrorTypes, ErrorDetails } from '../errors';
import AttrList from '../utils/attr-list';
import { logger } from '../utils/logger';

// https://regex101.com is your friend
var MASTER_PLAYLIST_REGEX = /#EXT-X-STREAM-INF:([^\n\r]*)[\r\n]+([^\r\n]+)/g;
var MASTER_PLAYLIST_MEDIA_REGEX = /#EXT-X-MEDIA:(.*)/g;

var LEVEL_PLAYLIST_REGEX_FAST = new RegExp([/#EXTINF:(\d*(?:\.\d+)?)(?:,(.*)\s+)?/.source, // duration (#EXTINF:<duration>,<title>), group 1 => duration, group 2 => title
/|(?!#)(\S+)/.source, // segment URI, group 3 => the URI (note newline is not eaten)
/|#EXT-X-BYTERANGE:*(.+)/.source, // next segment's byterange, group 4 => range spec (x@y)
/|#EXT-X-PROGRAM-DATE-TIME:(.+)/.source, // next segment's program date/time group 5 => the datetime spec
/|#.*/.source // All other non-segment oriented tags will match with all groups empty
].join(''), 'g');

var LEVEL_PLAYLIST_REGEX_SLOW = /(?:(?:#(EXTM3U))|(?:#EXT-X-(PLAYLIST-TYPE):(.+))|(?:#EXT-X-(MEDIA-SEQUENCE): *(\d+))|(?:#EXT-X-(TARGETDURATION): *(\d+))|(?:#EXT-X-(KEY):(.+))|(?:#EXT-X-(START):(.+))|(?:#EXT-X-(ENDLIST))|(?:#EXT-X-(DISCONTINUITY-SEQ)UENCE:(\d+))|(?:#EXT-X-(DIS)CONTINUITY))|(?:#EXT-X-(VERSION):(\d+))|(?:#EXT-X-(MAP):(.+))|(?:(#)(.*):(.*))|(?:(#)(.*))(?:.*)\r?\n?/;

var LevelKey = function () {
  function LevelKey() {
    _classCallCheck(this, LevelKey);

    this.method = null;
    this.key = null;
    this.iv = null;
    this._uri = null;
  }

  _createClass(LevelKey, [{
    key: 'uri',
    get: function get() {
      if (!this._uri && this.reluri) {
        this._uri = URLToolkit.buildAbsoluteURL(this.baseuri, this.reluri, { alwaysNormalize: true });
      }
      return this._uri;
    }
  }]);

  return LevelKey;
}();

var Fragment = function () {
  function Fragment() {
    _classCallCheck(this, Fragment);

    this._url = null;
    this._byteRange = null;
    this._decryptdata = null;
    this.tagList = [];
  }

  /**
   * Utility method for parseLevelPlaylist to create an initialization vector for a given segment
   * @returns {Uint8Array}
   */
  Fragment.prototype.createInitializationVector = function createInitializationVector(segmentNumber) {
    var uint8View = new Uint8Array(16);

    for (var i = 12; i < 16; i++) {
      uint8View[i] = segmentNumber >> 8 * (15 - i) & 0xff;
    }

    return uint8View;
  };

  /**
   * Utility method for parseLevelPlaylist to get a fragment's decryption data from the currently parsed encryption key data
   * @param levelkey - a playlist's encryption info
   * @param segmentNumber - the fragment's segment number
   * @returns {*} - an object to be applied as a fragment's decryptdata
   */


  Fragment.prototype.fragmentDecryptdataFromLevelkey = function fragmentDecryptdataFromLevelkey(levelkey, segmentNumber) {
    var decryptdata = levelkey;

    if (levelkey && levelkey.method && levelkey.uri && !levelkey.iv) {
      decryptdata = new LevelKey();
      decryptdata.method = levelkey.method;
      decryptdata.baseuri = levelkey.baseuri;
      decryptdata.reluri = levelkey.reluri;
      decryptdata.iv = this.createInitializationVector(segmentNumber);
    }

    return decryptdata;
  };

  Fragment.prototype.cloneObj = function cloneObj(obj) {
    return JSON.parse(JSON.stringify(obj));
  };

  _createClass(Fragment, [{
    key: 'url',
    get: function get() {
      if (!this._url && this.relurl) {
        this._url = URLToolkit.buildAbsoluteURL(this.baseurl, this.relurl, { alwaysNormalize: true });
      }
      return this._url;
    },
    set: function set(value) {
      this._url = value;
    }
  }, {
    key: 'programDateTime',
    get: function get() {
      if (!this._programDateTime && this.rawProgramDateTime) {
        this._programDateTime = new Date(Date.parse(this.rawProgramDateTime));
      }
      return this._programDateTime;
    }
  }, {
    key: 'byteRange',
    get: function get() {
      if (!this._byteRange) {
        var byteRange = this._byteRange = [];
        if (this.rawByteRange) {
          var params = this.rawByteRange.split('@', 2);
          if (params.length === 1) {
            var lastByteRangeEndOffset = this.lastByteRangeEndOffset;
            byteRange[0] = lastByteRangeEndOffset ? lastByteRangeEndOffset : 0;
          } else {
            byteRange[0] = parseInt(params[1]);
          }
          byteRange[1] = parseInt(params[0]) + byteRange[0];
        }
      }
      return this._byteRange;
    }
  }, {
    key: 'byteRangeStartOffset',
    get: function get() {
      return this.byteRange[0];
    }
  }, {
    key: 'byteRangeEndOffset',
    get: function get() {
      return this.byteRange[1];
    }
  }, {
    key: 'decryptdata',
    get: function get() {
      if (!this._decryptdata) {
        this._decryptdata = this.fragmentDecryptdataFromLevelkey(this.levelkey, this.sn);
      }
      return this._decryptdata;
    }
  }]);

  return Fragment;
}();

var PlaylistLoader = function (_EventHandler) {
  _inherits(PlaylistLoader, _EventHandler);

  function PlaylistLoader(hls) {
    _classCallCheck(this, PlaylistLoader);

    var _this = _possibleConstructorReturn(this, _EventHandler.call(this, hls, Event.MANIFEST_LOADING, Event.LEVEL_LOADING, Event.AUDIO_TRACK_LOADING, Event.SUBTITLE_TRACK_LOADING));

    _this.loaders = {};
    return _this;
  }

  PlaylistLoader.prototype.destroy = function destroy() {
    for (var loaderName in this.loaders) {
      var loader = this.loaders[loaderName];
      if (loader) {
        loader.destroy();
      }
    }
    this.loaders = {};
    EventHandler.prototype.destroy.call(this);
  };

  PlaylistLoader.prototype.onManifestLoading = function onManifestLoading(data) {
    this.load(data.url, { type: 'manifest' });
  };

  PlaylistLoader.prototype.onLevelLoading = function onLevelLoading(data) {
    this.load(data.url, { type: 'level', level: data.level, id: data.id });
  };

  PlaylistLoader.prototype.onAudioTrackLoading = function onAudioTrackLoading(data) {
    this.load(data.url, { type: 'audioTrack', id: data.id });
  };

  PlaylistLoader.prototype.onSubtitleTrackLoading = function onSubtitleTrackLoading(data) {
    this.load(data.url, { type: 'subtitleTrack', id: data.id });
  };

  PlaylistLoader.prototype.load = function load(url, context) {
    var loader = this.loaders[context.type];
    if (loader) {
      var loaderContext = loader.context;
      if (loaderContext && loaderContext.url === url) {
        logger.trace('playlist request ongoing');
        return;
      } else {
        logger.warn('abort previous loader for type:' + context.type);
        loader.abort();
      }
    }
    var config = this.hls.config,
        retry = void 0,
        timeout = void 0,
        retryDelay = void 0,
        maxRetryDelay = void 0;
    if (context.type === 'manifest') {
      retry = config.manifestLoadingMaxRetry;
      timeout = config.manifestLoadingTimeOut;
      retryDelay = config.manifestLoadingRetryDelay;
      maxRetryDelay = config.manifestLoadingMaxRetryTimeout;
    } else {
      retry = config.levelLoadingMaxRetry;
      timeout = config.levelLoadingTimeOut;
      retryDelay = config.levelLoadingRetryDelay;
      maxRetryDelay = config.levelLoadingMaxRetryTimeout;
      logger.log('loading playlist for ' + context.type + ' ' + (context.level || context.id));
    }
    loader = this.loaders[context.type] = context.loader = typeof config.pLoader !== 'undefined' ? new config.pLoader(config) : new config.loader(config);
    context.url = url;
    context.responseType = '';

    var loaderConfig = void 0,
        loaderCallbacks = void 0;
    loaderConfig = { timeout: timeout, maxRetry: retry, retryDelay: retryDelay, maxRetryDelay: maxRetryDelay };
    loaderCallbacks = { onSuccess: this.loadsuccess.bind(this), onError: this.loaderror.bind(this), onTimeout: this.loadtimeout.bind(this) };
    loader.load(context, loaderConfig, loaderCallbacks);
  };

  PlaylistLoader.prototype.resolve = function resolve(url, baseUrl) {
    return URLToolkit.buildAbsoluteURL(baseUrl, url, { alwaysNormalize: true });
  };

  PlaylistLoader.prototype.parseMasterPlaylist = function parseMasterPlaylist(string, baseurl) {
    var levels = [],
        result = void 0;
    MASTER_PLAYLIST_REGEX.lastIndex = 0;
    while ((result = MASTER_PLAYLIST_REGEX.exec(string)) != null) {
      var level = {};

      var attrs = level.attrs = new AttrList(result[1]);
      level.url = this.resolve(result[2], baseurl);

      var resolution = attrs.decimalResolution('RESOLUTION');
      if (resolution) {
        level.width = resolution.width;
        level.height = resolution.height;
      }
      level.bitrate = attrs.decimalInteger('AVERAGE-BANDWIDTH') || attrs.decimalInteger('BANDWIDTH');
      level.name = attrs.NAME;

      var codecs = attrs.CODECS;
      if (codecs) {
        codecs = codecs.split(/[ ,]+/);
        for (var i = 0; i < codecs.length; i++) {
          var codec = codecs[i];
          if (codec.indexOf('avc1') !== -1) {
            level.videoCodec = this.avc1toavcoti(codec);
          } else if (codec.indexOf('hvc1') !== -1) {
            level.videoCodec = codec;
          } else {
            level.audioCodec = codec;
          }
        }
      }

      levels.push(level);
    }
    return levels;
  };

  PlaylistLoader.prototype.parseMasterPlaylistMedia = function parseMasterPlaylistMedia(string, baseurl, type) {
    var audioCodec = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : null;

    var result = void 0,
        medias = [],
        id = 0;
    MASTER_PLAYLIST_MEDIA_REGEX.lastIndex = 0;
    while ((result = MASTER_PLAYLIST_MEDIA_REGEX.exec(string)) != null) {
      var media = {};
      var attrs = new AttrList(result[1]);
      if (attrs.TYPE === type) {
        media.groupId = attrs['GROUP-ID'];
        media.name = attrs.NAME;
        media.type = type;
        media.default = attrs.DEFAULT === 'YES';
        media.autoselect = attrs.AUTOSELECT === 'YES';
        media.forced = attrs.FORCED === 'YES';
        if (attrs.URI) {
          media.url = this.resolve(attrs.URI, baseurl);
        }
        media.lang = attrs.LANGUAGE;
        if (!media.name) {
          media.name = media.lang;
        }
        if (audioCodec) {
          media.audioCodec = audioCodec;
        }
        media.id = id++;
        medias.push(media);
      }
    }
    return medias;
  };

  PlaylistLoader.prototype.avc1toavcoti = function avc1toavcoti(codec) {
    var result,
        avcdata = codec.split('.');
    if (avcdata.length > 2) {
      result = avcdata.shift() + '.';
      result += parseInt(avcdata.shift()).toString(16);
      result += ('000' + parseInt(avcdata.shift()).toString(16)).substr(-4);
    } else {
      result = codec;
    }
    return result;
  };

  PlaylistLoader.prototype.parseLevelPlaylist = function parseLevelPlaylist(string, baseurl, id, type) {
    var currentSN = 0,
        totalduration = 0,
        level = { type: null, version: null, url: baseurl, fragments: [], live: true, startSN: 0 },
        levelkey = new LevelKey(),
        cc = 0,
        prevFrag = null,
        frag = new Fragment(),
        result,
        i;

    LEVEL_PLAYLIST_REGEX_FAST.lastIndex = 0;

    while ((result = LEVEL_PLAYLIST_REGEX_FAST.exec(string)) !== null) {
      var duration = result[1];
      if (duration) {
        // INF
        frag.duration = parseFloat(duration);
        // avoid sliced strings    https://github.com/video-dev/hls.js/issues/939
        var title = (' ' + result[2]).slice(1);
        frag.title = title ? title : null;
        frag.tagList.push(title ? ['INF', duration, title] : ['INF', duration]);
      } else if (result[3]) {
        // url
        if (!isNaN(frag.duration)) {
          var sn = currentSN++;
          frag.type = type;
          frag.start = totalduration;
          frag.levelkey = levelkey;
          frag.sn = sn;
          frag.level = id;
          frag.cc = cc;
          frag.baseurl = baseurl;
          // avoid sliced strings    https://github.com/video-dev/hls.js/issues/939
          frag.relurl = (' ' + result[3]).slice(1);

          level.fragments.push(frag);
          prevFrag = frag;
          totalduration += frag.duration;

          frag = new Fragment();
        }
      } else if (result[4]) {
        // X-BYTERANGE
        frag.rawByteRange = (' ' + result[4]).slice(1);
        if (prevFrag) {
          var lastByteRangeEndOffset = prevFrag.byteRangeEndOffset;
          if (lastByteRangeEndOffset) {
            frag.lastByteRangeEndOffset = lastByteRangeEndOffset;
          }
        }
      } else if (result[5]) {
        // PROGRAM-DATE-TIME
        // avoid sliced strings    https://github.com/video-dev/hls.js/issues/939
        frag.rawProgramDateTime = (' ' + result[5]).slice(1);
        frag.tagList.push(['PROGRAM-DATE-TIME', frag.rawProgramDateTime]);
      } else {
        result = result[0].match(LEVEL_PLAYLIST_REGEX_SLOW);
        for (i = 1; i < result.length; i++) {
          if (result[i] !== undefined) {
            break;
          }
        }

        // avoid sliced strings    https://github.com/video-dev/hls.js/issues/939
        var value1 = (' ' + result[i + 1]).slice(1);
        var value2 = (' ' + result[i + 2]).slice(1);

        switch (result[i]) {
          case '#':
            frag.tagList.push(value2 ? [value1, value2] : [value1]);
            break;
          case 'PLAYLIST-TYPE':
            level.type = value1.toUpperCase();
            break;
          case 'MEDIA-SEQUENCE':
            currentSN = level.startSN = parseInt(value1);
            break;
          case 'TARGETDURATION':
            level.targetduration = parseFloat(value1);
            break;
          case 'VERSION':
            level.version = parseInt(value1);
            break;
          case 'EXTM3U':
            break;
          case 'ENDLIST':
            level.live = false;
            break;
          case 'DIS':
            cc++;
            frag.tagList.push(['DIS']);
            break;
          case 'DISCONTINUITY-SEQ':
            cc = parseInt(value1);
            break;
          case 'KEY':
            // https://tools.ietf.org/html/draft-pantos-http-live-streaming-08#section-3.4.4
            var decryptparams = value1;
            var keyAttrs = new AttrList(decryptparams);
            var decryptmethod = keyAttrs.enumeratedString('METHOD'),
                decrypturi = keyAttrs.URI,
                decryptiv = keyAttrs.hexadecimalInteger('IV');
            if (decryptmethod) {
              levelkey = new LevelKey();
              if (decrypturi && ['AES-128', 'SAMPLE-AES'].indexOf(decryptmethod) >= 0) {
                levelkey.method = decryptmethod;
                // URI to get the key
                levelkey.baseuri = baseurl;
                levelkey.reluri = decrypturi;
                levelkey.key = null;
                // Initialization Vector (IV)
                levelkey.iv = decryptiv;
              }
            }
            break;
          case 'START':
            var startParams = value1;
            var startAttrs = new AttrList(startParams);
            var startTimeOffset = startAttrs.decimalFloatingPoint('TIME-OFFSET');
            //TIME-OFFSET can be 0
            if (!isNaN(startTimeOffset)) {
              level.startTimeOffset = startTimeOffset;
            }
            break;
          case 'MAP':
            var mapAttrs = new AttrList(value1);
            frag.relurl = mapAttrs.URI;
            frag.rawByteRange = mapAttrs.BYTERANGE;
            frag.baseurl = baseurl;
            frag.level = id;
            frag.type = type;
            frag.sn = 'initSegment';
            level.initSegment = frag;
            frag = new Fragment();
            break;
          default:
            logger.warn('line parsed but not handled: ' + result);
            break;
        }
      }
    }
    frag = prevFrag;
    //logger.log('found ' + level.fragments.length + ' fragments');
    if (frag && !frag.relurl) {
      level.fragments.pop();
      totalduration -= frag.duration;
    }
    level.totalduration = totalduration;
    level.averagetargetduration = totalduration / level.fragments.length;
    level.endSN = currentSN - 1;
    return level;
  };

  PlaylistLoader.prototype.loadsuccess = function loadsuccess(response, stats, context) {
    var networkDetails = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : null;

    var string = response.data,
        url = response.url,
        type = context.type,
        id = context.id,
        level = context.level,
        hls = this.hls;

    this.loaders[type] = undefined;
    // responseURL not supported on some browsers (it is used to detect URL redirection)
    // data-uri mode also not supported (but no need to detect redirection)
    if (url === undefined || url.indexOf('data:') === 0) {
      // fallback to initial URL
      url = context.url;
    }
    stats.tload = performance.now();
    //stats.mtime = new Date(target.getResponseHeader('Last-Modified'));
    if (string.indexOf('#EXTM3U') === 0) {
      if (string.indexOf('#EXTINF:') > 0) {
        var isLevel = type !== 'audioTrack' && type !== 'subtitleTrack',
            levelId = !isNaN(level) ? level : !isNaN(id) ? id : 0,
            levelDetails = this.parseLevelPlaylist(string, url, levelId, type === 'audioTrack' ? 'audio' : type === 'subtitleTrack' ? 'subtitle' : 'main');
        levelDetails.tload = stats.tload;
        if (type === 'manifest') {
          // first request, stream manifest (no master playlist), fire manifest loaded event with level details
          hls.trigger(Event.MANIFEST_LOADED, { levels: [{ url: url, details: levelDetails }], audioTracks: [], url: url, stats: stats, networkDetails: networkDetails });
        }
        stats.tparsed = performance.now();
        if (levelDetails.targetduration) {
          if (isLevel) {
            hls.trigger(Event.LEVEL_LOADED, { details: levelDetails, level: level || 0, id: id || 0, stats: stats, networkDetails: networkDetails });
          } else {
            if (type === 'audioTrack') {
              hls.trigger(Event.AUDIO_TRACK_LOADED, { details: levelDetails, id: id, stats: stats, networkDetails: networkDetails });
            } else if (type === 'subtitleTrack') {
              hls.trigger(Event.SUBTITLE_TRACK_LOADED, { details: levelDetails, id: id, stats: stats, networkDetails: networkDetails });
            }
          }
        } else {
          hls.trigger(Event.ERROR, { type: ErrorTypes.NETWORK_ERROR, details: ErrorDetails.MANIFEST_PARSING_ERROR, fatal: true, url: url, reason: 'invalid targetduration', networkDetails: networkDetails });
        }
      } else {
        var levels = this.parseMasterPlaylist(string, url);
        // multi level playlist, parse level info
        if (levels.length) {
          var audioTracks = this.parseMasterPlaylistMedia(string, url, 'AUDIO', levels[0].audioCodec);
          var subtitles = this.parseMasterPlaylistMedia(string, url, 'SUBTITLES');
          if (audioTracks.length) {
            // check if we have found an audio track embedded in main playlist (audio track without URI attribute)
            var embeddedAudioFound = false;
            audioTracks.forEach(function (audioTrack) {
              if (!audioTrack.url) {
                embeddedAudioFound = true;
              }
            });
            // if no embedded audio track defined, but audio codec signaled in quality level, we need to signal this main audio track
            // this could happen with playlists with alt audio rendition in which quality levels (main) contains both audio+video. but with mixed audio track not signaled
            if (embeddedAudioFound === false && levels[0].audioCodec && !levels[0].attrs.AUDIO) {
              logger.log('audio codec signaled in quality level, but no embedded audio track signaled, create one');
              audioTracks.unshift({ type: 'main', name: 'main' });
            }
          }
          hls.trigger(Event.MANIFEST_LOADED, { levels: levels, audioTracks: audioTracks, subtitles: subtitles, url: url, stats: stats, networkDetails: networkDetails });
        } else {
          hls.trigger(Event.ERROR, { type: ErrorTypes.NETWORK_ERROR, details: ErrorDetails.MANIFEST_PARSING_ERROR, fatal: true, url: url, reason: 'no level found in manifest', networkDetails: networkDetails });
        }
      }
    } else {
      hls.trigger(Event.ERROR, { type: ErrorTypes.NETWORK_ERROR, details: ErrorDetails.MANIFEST_PARSING_ERROR, fatal: true, url: url, reason: 'no EXTM3U delimiter', networkDetails: networkDetails });
    }
  };

  PlaylistLoader.prototype.loaderror = function loaderror(response, context) {
    var networkDetails = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;

    var details,
        fatal,
        loader = context.loader;
    switch (context.type) {
      case 'manifest':
        details = ErrorDetails.MANIFEST_LOAD_ERROR;
        fatal = true;
        break;
      case 'level':
        details = ErrorDetails.LEVEL_LOAD_ERROR;
        fatal = false;
        break;
      case 'audioTrack':
        details = ErrorDetails.AUDIO_TRACK_LOAD_ERROR;
        fatal = false;
        break;
    }
    if (loader) {
      loader.abort();
      this.loaders[context.type] = undefined;
    }
    this.hls.trigger(Event.ERROR, { type: ErrorTypes.NETWORK_ERROR, details: details, fatal: fatal, url: loader.url, loader: loader, response: response, context: context, networkDetails: networkDetails });
  };

  PlaylistLoader.prototype.loadtimeout = function loadtimeout(stats, context) {
    var networkDetails = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;

    var details,
        fatal,
        loader = context.loader;
    switch (context.type) {
      case 'manifest':
        details = ErrorDetails.MANIFEST_LOAD_TIMEOUT;
        fatal = true;
        break;
      case 'level':
        details = ErrorDetails.LEVEL_LOAD_TIMEOUT;
        fatal = false;
        break;
      case 'audioTrack':
        details = ErrorDetails.AUDIO_TRACK_LOAD_TIMEOUT;
        fatal = false;
        break;
    }
    if (loader) {
      loader.abort();
      this.loaders[context.type] = undefined;
    }
    this.hls.trigger(Event.ERROR, { type: ErrorTypes.NETWORK_ERROR, details: details, fatal: fatal, url: loader.url, loader: loader, context: context, networkDetails: networkDetails });
  };

  return PlaylistLoader;
}(EventHandler);

export default PlaylistLoader;