# hls.js

This is a modified version of [video-dev/hls.js](https://github.com/video-dev/hls.js).

## Getting Started

``` bash
$ npm i --save @youkufe/hls.js
```

## Usages

Define a video element

```html
<video id="video"></video>
```

``` js
import Hls from '@youkufe/hls.js';

if (Hls.isSupported()) {
    // query video element
    var video = document.querySelector('#video');

    var hls = new Hls();

	hls.attachMedia(video);

    hls.on(Hls.Events.MEDIA_ATTACHED, function () {
        console.log("video and hls.js are now bound together !");

		hls.loadSource("http://my.streamURL.com/playlist.m3u8");

        hls.on(Hls.Events.MANIFEST_PARSED, function (event, data) {

            console.log("manifest loaded, found " + data.levels.length + " quality level");

        });
	});
}
```

## 更小的体积

454kb -> 156KB （uglify）

*可以后期根据返回的m3u8 的文件回复对于这些功能的支持*

- demux/aacdemuxer.js，音频demux
- controller/audio-stream-controller.js
- controller/audio-track-controller.js，附加的音频流
- controller/subtitle-stream-controller.js，字幕
- controller/subtitle-track-controller.js
- controller/timeline-controller.js
- crypt/decrypter，解密

## 增加的事件

- `Events.FRAME_UPDATED`，触发帧更新(HLS 内部实现比 video 更精确的更新事件)

## 声明
