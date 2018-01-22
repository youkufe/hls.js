function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/*
 * Fragment Loader
*/

import Event from '../events';
import EventHandler from '../event-handler';
import { ErrorTypes, ErrorDetails } from '../errors';
import { logger } from '../utils/logger';

var FragmentLoader = function (_EventHandler) {
  _inherits(FragmentLoader, _EventHandler);

  function FragmentLoader(hls) {
    _classCallCheck(this, FragmentLoader);

    var _this = _possibleConstructorReturn(this, _EventHandler.call(this, hls, Event.FRAG_LOADING));

    _this.loaders = {};
    return _this;
  }

  FragmentLoader.prototype.destroy = function destroy() {
    var loaders = this.loaders;
    for (var loaderName in loaders) {
      var loader = loaders[loaderName];
      if (loader) {
        loader.destroy();
      }
    }
    this.loaders = {};
    EventHandler.prototype.destroy.call(this);
  };

  FragmentLoader.prototype.onFragLoading = function onFragLoading(data) {
    var frag = data.frag,
        type = frag.type,
        loader = this.loaders[type],
        config = this.hls.config;

    frag.loaded = 0;
    if (loader) {
      logger.warn('abort previous fragment loader for type:' + type);
      loader.abort();
    }
    loader = this.loaders[type] = frag.loader = typeof config.fLoader !== 'undefined' ? new config.fLoader(config) : new config.loader(config);

    var loaderContext = void 0,
        loaderConfig = void 0,
        loaderCallbacks = void 0;
    loaderContext = { url: frag.url, frag: frag, responseType: 'arraybuffer', progressData: false };
    var start = frag.byteRangeStartOffset,
        end = frag.byteRangeEndOffset;
    if (!isNaN(start) && !isNaN(end)) {
      loaderContext.rangeStart = start;
      loaderContext.rangeEnd = end;
    }
    loaderConfig = { timeout: config.fragLoadingTimeOut, maxRetry: 0, retryDelay: 0, maxRetryDelay: config.fragLoadingMaxRetryTimeout };
    loaderCallbacks = { onSuccess: this.loadsuccess.bind(this), onError: this.loaderror.bind(this), onTimeout: this.loadtimeout.bind(this), onProgress: this.loadprogress.bind(this) };
    loader.load(loaderContext, loaderConfig, loaderCallbacks);
  };

  FragmentLoader.prototype.loadsuccess = function loadsuccess(response, stats, context) {
    var networkDetails = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : null;

    var payload = response.data,
        frag = context.frag;
    // detach fragment loader on load success
    frag.loader = undefined;
    this.loaders[frag.type] = undefined;
    this.hls.trigger(Event.FRAG_LOADED, { payload: payload, frag: frag, stats: stats, networkDetails: networkDetails });
  };

  FragmentLoader.prototype.loaderror = function loaderror(response, context) {
    var networkDetails = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;

    var loader = context.loader;
    if (loader) {
      loader.abort();
    }
    this.loaders[context.type] = undefined;
    this.hls.trigger(Event.ERROR, { type: ErrorTypes.NETWORK_ERROR, details: ErrorDetails.FRAG_LOAD_ERROR, fatal: false, frag: context.frag, response: response, networkDetails: networkDetails });
  };

  FragmentLoader.prototype.loadtimeout = function loadtimeout(stats, context) {
    var networkDetails = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;

    var loader = context.loader;
    if (loader) {
      loader.abort();
    }
    this.loaders[context.type] = undefined;
    this.hls.trigger(Event.ERROR, { type: ErrorTypes.NETWORK_ERROR, details: ErrorDetails.FRAG_LOAD_TIMEOUT, fatal: false, frag: context.frag, networkDetails: networkDetails });
  };

  // data will be used for progressive parsing


  FragmentLoader.prototype.loadprogress = function loadprogress(stats, context, data) {
    var networkDetails = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : null;
    // jshint ignore:line
    var frag = context.frag;
    frag.loaded = stats.loaded;
    this.hls.trigger(Event.FRAG_LOAD_PROGRESS, { frag: frag, stats: stats, networkDetails: networkDetails });
  };

  return FragmentLoader;
}(EventHandler);

export default FragmentLoader;