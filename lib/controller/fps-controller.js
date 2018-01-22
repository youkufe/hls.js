function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/*
 * FPS Controller
*/

import Event from '../events';
import EventHandler from '../event-handler';
import { logger } from '../utils/logger';

var FPSController = function (_EventHandler) {
  _inherits(FPSController, _EventHandler);

  function FPSController(hls) {
    _classCallCheck(this, FPSController);

    return _possibleConstructorReturn(this, _EventHandler.call(this, hls, Event.MEDIA_ATTACHING));
  }

  FPSController.prototype.destroy = function destroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.isVideoPlaybackQualityAvailable = false;
  };

  FPSController.prototype.onMediaAttaching = function onMediaAttaching(data) {
    var config = this.hls.config;
    if (config.capLevelOnFPSDrop) {
      var video = this.video = data.media instanceof HTMLVideoElement ? data.media : null;
      if (typeof video.getVideoPlaybackQuality === 'function') {
        this.isVideoPlaybackQualityAvailable = true;
      }
      clearInterval(this.timer);
      this.timer = setInterval(this.checkFPSInterval.bind(this), config.fpsDroppedMonitoringPeriod);
    }
  };

  FPSController.prototype.checkFPS = function checkFPS(video, decodedFrames, droppedFrames) {
    var currentTime = performance.now();
    if (decodedFrames) {
      if (this.lastTime) {
        var currentPeriod = currentTime - this.lastTime,
            currentDropped = droppedFrames - this.lastDroppedFrames,
            currentDecoded = decodedFrames - this.lastDecodedFrames,
            droppedFPS = 1000 * currentDropped / currentPeriod,
            hls = this.hls;
        hls.trigger(Event.FPS_DROP, { currentDropped: currentDropped, currentDecoded: currentDecoded, totalDroppedFrames: droppedFrames });
        if (droppedFPS > 0) {
          //logger.log('checkFPS : droppedFPS/decodedFPS:' + droppedFPS/(1000 * currentDecoded / currentPeriod));
          if (currentDropped > hls.config.fpsDroppedMonitoringThreshold * currentDecoded) {
            var currentLevel = hls.currentLevel;
            logger.warn('drop FPS ratio greater than max allowed value for currentLevel: ' + currentLevel);
            if (currentLevel > 0 && (hls.autoLevelCapping === -1 || hls.autoLevelCapping >= currentLevel)) {
              currentLevel = currentLevel - 1;
              hls.trigger(Event.FPS_DROP_LEVEL_CAPPING, { level: currentLevel, droppedLevel: hls.currentLevel });
              hls.autoLevelCapping = currentLevel;
              hls.streamController.nextLevelSwitch();
            }
          }
        }
      }
      this.lastTime = currentTime;
      this.lastDroppedFrames = droppedFrames;
      this.lastDecodedFrames = decodedFrames;
    }
  };

  FPSController.prototype.checkFPSInterval = function checkFPSInterval() {
    var video = this.video;
    if (video) {
      if (this.isVideoPlaybackQualityAvailable) {
        var videoPlaybackQuality = video.getVideoPlaybackQuality();
        this.checkFPS(video, videoPlaybackQuality.totalVideoFrames, videoPlaybackQuality.droppedVideoFrames);
      } else {
        this.checkFPS(video, video.webkitDecodedFrameCount, video.webkitDroppedFrameCount);
      }
    }
  };

  return FPSController;
}(EventHandler);

export default FPSController;