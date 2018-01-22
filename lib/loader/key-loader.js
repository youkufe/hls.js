function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/*
 * Decrypt key Loader
*/

import Event from '../events';
import EventHandler from '../event-handler';
import { ErrorTypes, ErrorDetails } from '../errors';
import { logger } from '../utils/logger';

var KeyLoader = function (_EventHandler) {
  _inherits(KeyLoader, _EventHandler);

  function KeyLoader(hls) {
    _classCallCheck(this, KeyLoader);

    var _this = _possibleConstructorReturn(this, _EventHandler.call(this, hls, Event.KEY_LOADING));

    _this.loaders = {};
    _this.decryptkey = null;
    _this.decrypturl = null;
    return _this;
  }

  KeyLoader.prototype.destroy = function destroy() {
    for (var loaderName in this.loaders) {
      var loader = this.loaders[loaderName];
      if (loader) {
        loader.destroy();
      }
    }
    this.loaders = {};
    EventHandler.prototype.destroy.call(this);
  };

  KeyLoader.prototype.onKeyLoading = function onKeyLoading(data) {
    var frag = data.frag,
        type = frag.type,
        loader = this.loaders[type],
        decryptdata = frag.decryptdata,
        uri = decryptdata.uri;
    // if uri is different from previous one or if decrypt key not retrieved yet
    if (uri !== this.decrypturl || this.decryptkey === null) {
      var config = this.hls.config;

      if (loader) {
        logger.warn('abort previous key loader for type:' + type);
        loader.abort();
      }
      frag.loader = this.loaders[type] = new config.loader(config);
      this.decrypturl = uri;
      this.decryptkey = null;

      var loaderContext = void 0,
          loaderConfig = void 0,
          loaderCallbacks = void 0;
      loaderContext = { url: uri, frag: frag, responseType: 'arraybuffer' };
      loaderConfig = { timeout: config.fragLoadingTimeOut, maxRetry: config.fragLoadingMaxRetry, retryDelay: config.fragLoadingRetryDelay, maxRetryDelay: config.fragLoadingMaxRetryTimeout };
      loaderCallbacks = { onSuccess: this.loadsuccess.bind(this), onError: this.loaderror.bind(this), onTimeout: this.loadtimeout.bind(this) };
      frag.loader.load(loaderContext, loaderConfig, loaderCallbacks);
    } else if (this.decryptkey) {
      // we already loaded this key, return it
      decryptdata.key = this.decryptkey;
      this.hls.trigger(Event.KEY_LOADED, { frag: frag });
    }
  };

  KeyLoader.prototype.loadsuccess = function loadsuccess(response, stats, context) {
    var frag = context.frag;
    this.decryptkey = frag.decryptdata.key = new Uint8Array(response.data);
    // detach fragment loader on load success
    frag.loader = undefined;
    this.loaders[frag.type] = undefined;
    this.hls.trigger(Event.KEY_LOADED, { frag: frag });
  };

  KeyLoader.prototype.loaderror = function loaderror(response, context) {
    var frag = context.frag,
        loader = frag.loader;
    if (loader) {
      loader.abort();
    }
    this.loaders[context.type] = undefined;
    this.hls.trigger(Event.ERROR, { type: ErrorTypes.NETWORK_ERROR, details: ErrorDetails.KEY_LOAD_ERROR, fatal: false, frag: frag, response: response });
  };

  KeyLoader.prototype.loadtimeout = function loadtimeout(stats, context) {
    var frag = context.frag,
        loader = frag.loader;
    if (loader) {
      loader.abort();
    }
    this.loaders[context.type] = undefined;
    this.hls.trigger(Event.ERROR, { type: ErrorTypes.NETWORK_ERROR, details: ErrorDetails.KEY_LOAD_TIMEOUT, fatal: false, frag: frag });
  };

  return KeyLoader;
}(EventHandler);

export default KeyLoader;