function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Fetch based logger
 * timeout / abort / onprogress not supported for now
 * timeout / abort : some ideas here : https://github.com/whatwg/fetch/issues/20#issuecomment-196113354
 * but still it is not bullet proof as it fails to avoid data waste....
*/

var FetchLoader = function () {
  function FetchLoader(config) {
    _classCallCheck(this, FetchLoader);

    this.fetchSetup = config.fetchSetup;
  }

  FetchLoader.prototype.destroy = function destroy() {};

  FetchLoader.prototype.abort = function abort() {};

  FetchLoader.prototype.load = function load(context, config, callbacks) {
    var stats = { trequest: performance.now(), retry: 0 },
        targetURL = context.url,
        request = void 0,
        initParams = { method: 'GET',
      mode: 'cors',
      credentials: 'same-origin'
    };

    if (context.rangeEnd) {
      initParams.headers = new Headers({ 'Range': 'bytes=' + context.rangeStart + '-' + (context.rangeEnd - 1) });
    }

    if (this.fetchSetup) {
      request = this.fetchSetup(context, initParams);
    } else {
      request = new Request(context.url, initParams);
    }

    var fetchPromise = fetch(request, initParams);

    // process fetchPromise
    var responsePromise = fetchPromise.then(function (response) {
      if (response.ok) {
        stats.tfirst = Math.max(stats.trequest, performance.now());
        targetURL = response.url;
        if (context.responseType === 'arraybuffer') {
          return response.arrayBuffer();
        } else {
          return response.text();
        }
      } else {
        callbacks.onError({ text: 'fetch, bad network response' }, context);
        return;
      }
    }).catch(function (error) {
      callbacks.onError({ text: error.message }, context);
      return;
    });
    // process response Promise
    responsePromise.then(function (responseData) {
      if (responseData) {
        stats.tload = Math.max(stats.tfirst, performance.now());
        var len = void 0;
        if (typeof responseData === 'string') {
          len = responseData.length;
        } else {
          len = responseData.byteLength;
        }
        stats.loaded = stats.total = len;
        var response = { url: targetURL, data: responseData };
        callbacks.onSuccess(response, stats, context);
      }
    });
  };

  return FetchLoader;
}();

export default FetchLoader;