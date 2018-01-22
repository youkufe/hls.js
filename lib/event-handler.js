var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/*
*
* All objects in the event handling chain should inherit from this class
*
*/

import { logger } from './utils/logger';
import { ErrorTypes, ErrorDetails } from './errors';
import Event from './events';

var EventHandler = function () {
  function EventHandler(hls) {
    _classCallCheck(this, EventHandler);

    this.hls = hls;
    this.onEvent = this.onEvent.bind(this);

    for (var _len = arguments.length, events = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      events[_key - 1] = arguments[_key];
    }

    this.handledEvents = events;
    this.useGenericHandler = true;

    this.registerListeners();
  }

  EventHandler.prototype.destroy = function destroy() {
    this.unregisterListeners();
  };

  EventHandler.prototype.isEventHandler = function isEventHandler() {
    return _typeof(this.handledEvents) === 'object' && this.handledEvents.length && typeof this.onEvent === 'function';
  };

  EventHandler.prototype.registerListeners = function registerListeners() {
    if (this.isEventHandler()) {
      this.handledEvents.forEach(function (event) {
        if (event === 'hlsEventGeneric') {
          throw new Error('Forbidden event name: ' + event);
        }
        this.hls.on(event, this.onEvent);
      }, this);
    }
  };

  EventHandler.prototype.unregisterListeners = function unregisterListeners() {
    if (this.isEventHandler()) {
      this.handledEvents.forEach(function (event) {
        this.hls.off(event, this.onEvent);
      }, this);
    }
  };

  /**
   * arguments: event (string), data (any)
   */


  EventHandler.prototype.onEvent = function onEvent(event, data) {
    this.onEventGeneric(event, data);
  };

  EventHandler.prototype.onEventGeneric = function onEventGeneric(event, data) {
    var eventToFunction = function eventToFunction(event, data) {
      var funcName = 'on' + event.replace('hls', '');
      if (typeof this[funcName] !== 'function') {
        throw new Error('Event ' + event + ' has no generic handler in this ' + this.constructor.name + ' class (tried ' + funcName + ')');
      }
      return this[funcName].bind(this, data);
    };
    try {
      eventToFunction.call(this, event, data).call();
    } catch (err) {
      logger.error('internal error happened while processing ' + event + ':' + err.message);
      this.hls.trigger(Event.ERROR, { type: ErrorTypes.OTHER_ERROR, details: ErrorDetails.INTERNAL_EXCEPTION, fatal: false, event: event, err: err });
    }
  };

  return EventHandler;
}();

export default EventHandler;