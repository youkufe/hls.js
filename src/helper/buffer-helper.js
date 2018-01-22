/**
 * Buffer Helper utils, providing methods dealing buffer length retrieval
*/

const BufferHelper = {
  isBuffered : function(media,position) {
    if (media) {
      let buffered = media.buffered;
      for (let i = 0; i < buffered.length; i++) {
        if (position >= buffered.start(i) && position <= buffered.end(i)) {
          return true;
        }
      }
    }
    return false;
  },

  bufferInfo : function(media, pos,maxHoleDuration) {
    if (media) {
      var vbuffered = media.buffered, buffered = [],i;
      for (i = 0; i < vbuffered.length; i++) {
        buffered.push({start: vbuffered.start(i), end: vbuffered.end(i)});
      }
      return this.bufferedInfo(buffered,pos,maxHoleDuration);
    } else {
      return {len: 0, start: pos, end: pos, nextStart : undefined} ;
    }
  },

  bufferedInfo : function(buffered,pos,maxHoleDuration) {
    var buffered2 = [],

        bufferLen,bufferStart, bufferEnd,bufferStartNext,i;
    // 首先我们根据时间开始的先后进行排序
    buffered.sort(function (a, b) {
      var diff = a.start - b.start;
      if (diff) {
        return diff;
      } else {
        return b.end - a.end;
      }
    });
    // 我们需要将持续时间小于最大 duration给 排除掉
    for (i = 0; i < buffered.length; i++) {
      var buf2len = buffered2.length;
      if(buf2len) {
        var buf2end = buffered2[buf2len - 1].end;
        // if small hole (value between 0 or maxHoleDuration ) or overlapping (negative)
        if((buffered[i].start - buf2end) < maxHoleDuration) {
          // 需要合并结束时间点小于目前最长的时间点
          if(buffered[i].end > buf2end) {
            buffered2[buf2len - 1].end = buffered[i].end;
          }
        } else {
          // big hole
          buffered2.push(buffered[i]);
        }
      } else {
        // first value
        buffered2.push(buffered[i]);
      }
    }
    for (i = 0, bufferLen = 0, bufferStart = bufferEnd = pos; i < buffered2.length; i++) {
      var start =  buffered2[i].start,
          end = buffered2[i].end;
      if ((pos + maxHoleDuration) >= start && pos < end) {
        // 位置在当前的片段里面
        bufferStart = start;
        bufferEnd = end;
        bufferLen = bufferEnd - pos;
      } else if ((pos + maxHoleDuration) < start) {
        bufferStartNext = start;
        break;
      }
    }
    return {len: bufferLen, start: bufferStart, end: bufferEnd, nextStart : bufferStartNext};
  }
};

export default BufferHelper;
