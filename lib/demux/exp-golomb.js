function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Parser for exponential Golomb codes, a variable-bitwidth number encoding scheme used by h264.
*/

import { logger } from '../utils/logger';

var ExpGolomb = function () {
  function ExpGolomb(data) {
    _classCallCheck(this, ExpGolomb);

    this.data = data;
    // the number of bytes left to examine in this.data
    this.bytesAvailable = data.byteLength;
    // the current word being examined
    this.word = 0; // :uint
    // the number of bits left to examine in the current word
    this.bitsAvailable = 0; // :uint
  }

  // ():void


  ExpGolomb.prototype.loadWord = function loadWord() {
    var data = this.data,
        bytesAvailable = this.bytesAvailable,
        position = data.byteLength - bytesAvailable,
        workingBytes = new Uint8Array(4),
        availableBytes = Math.min(4, bytesAvailable);
    if (availableBytes === 0) {
      throw new Error('no bytes available');
    }
    workingBytes.set(data.subarray(position, position + availableBytes));
    this.word = new DataView(workingBytes.buffer).getUint32(0);
    // track the amount of this.data that has been processed
    this.bitsAvailable = availableBytes * 8;
    this.bytesAvailable -= availableBytes;
  };

  // (count:int):void


  ExpGolomb.prototype.skipBits = function skipBits(count) {
    var skipBytes; // :int
    if (this.bitsAvailable > count) {
      this.word <<= count;
      this.bitsAvailable -= count;
    } else {
      count -= this.bitsAvailable;
      skipBytes = count >> 3;
      count -= skipBytes >> 3;
      this.bytesAvailable -= skipBytes;
      this.loadWord();
      this.word <<= count;
      this.bitsAvailable -= count;
    }
  };

  // (size:int):uint


  ExpGolomb.prototype.readBits = function readBits(size) {
    var bits = Math.min(this.bitsAvailable, size),
        // :uint
    valu = this.word >>> 32 - bits; // :uint
    if (size > 32) {
      logger.error('Cannot read more than 32 bits at a time');
    }
    this.bitsAvailable -= bits;
    if (this.bitsAvailable > 0) {
      this.word <<= bits;
    } else if (this.bytesAvailable > 0) {
      this.loadWord();
    }
    bits = size - bits;
    if (bits > 0 && this.bitsAvailable) {
      return valu << bits | this.readBits(bits);
    } else {
      return valu;
    }
  };

  // ():uint


  ExpGolomb.prototype.skipLZ = function skipLZ() {
    var leadingZeroCount; // :uint
    for (leadingZeroCount = 0; leadingZeroCount < this.bitsAvailable; ++leadingZeroCount) {
      if (0 !== (this.word & 0x80000000 >>> leadingZeroCount)) {
        // the first bit of working word is 1
        this.word <<= leadingZeroCount;
        this.bitsAvailable -= leadingZeroCount;
        return leadingZeroCount;
      }
    }
    // we exhausted word and still have not found a 1
    this.loadWord();
    return leadingZeroCount + this.skipLZ();
  };

  // ():void


  ExpGolomb.prototype.skipUEG = function skipUEG() {
    this.skipBits(1 + this.skipLZ());
  };

  // ():void


  ExpGolomb.prototype.skipEG = function skipEG() {
    this.skipBits(1 + this.skipLZ());
  };

  // ():uint


  ExpGolomb.prototype.readUEG = function readUEG() {
    var clz = this.skipLZ(); // :uint
    return this.readBits(clz + 1) - 1;
  };

  // ():int


  ExpGolomb.prototype.readEG = function readEG() {
    var valu = this.readUEG(); // :int
    if (0x01 & valu) {
      // the number is odd if the low order bit is set
      return 1 + valu >>> 1; // add 1 to make it even, and divide by 2
    } else {
      return -1 * (valu >>> 1); // divide by two then make it negative
    }
  };

  // Some convenience functions
  // :Boolean


  ExpGolomb.prototype.readBoolean = function readBoolean() {
    return 1 === this.readBits(1);
  };

  // ():int


  ExpGolomb.prototype.readUByte = function readUByte() {
    return this.readBits(8);
  };

  // ():int


  ExpGolomb.prototype.readUShort = function readUShort() {
    return this.readBits(16);
  };
  // ():int


  ExpGolomb.prototype.readUInt = function readUInt() {
    return this.readBits(32);
  };

  /**
   * Advance the ExpGolomb decoder past a scaling list. The scaling
   * list is optionally transmitted as part of a sequence parameter
   * set and is not relevant to transmuxing.
   * @param count {number} the number of entries in this scaling list
   * @see Recommendation ITU-T H.264, Section 7.3.2.1.1.1
   */


  ExpGolomb.prototype.skipScalingList = function skipScalingList(count) {
    var lastScale = 8,
        nextScale = 8,
        j,
        deltaScale;
    for (j = 0; j < count; j++) {
      if (nextScale !== 0) {
        deltaScale = this.readEG();
        nextScale = (lastScale + deltaScale + 256) % 256;
      }
      lastScale = nextScale === 0 ? lastScale : nextScale;
    }
  };

  /**
   * Read a sequence parameter set and return some interesting video
   * properties. A sequence parameter set is the H264 metadata that
   * describes the properties of upcoming video frames.
   * @param data {Uint8Array} the bytes of a sequence parameter set
   * @return {object} an object with configuration parsed from the
   * sequence parameter set, including the dimensions of the
   * associated video frames.
   */


  ExpGolomb.prototype.readSPS = function readSPS() {
    var frameCropLeftOffset = 0,
        frameCropRightOffset = 0,
        frameCropTopOffset = 0,
        frameCropBottomOffset = 0,
        profileIdc,
        profileCompat,
        levelIdc,
        numRefFramesInPicOrderCntCycle,
        picWidthInMbsMinus1,
        picHeightInMapUnitsMinus1,
        frameMbsOnlyFlag,
        scalingListCount,
        i,
        readUByte = this.readUByte.bind(this),
        readBits = this.readBits.bind(this),
        readUEG = this.readUEG.bind(this),
        readBoolean = this.readBoolean.bind(this),
        skipBits = this.skipBits.bind(this),
        skipEG = this.skipEG.bind(this),
        skipUEG = this.skipUEG.bind(this),
        skipScalingList = this.skipScalingList.bind(this);

    readUByte();
    profileIdc = readUByte(); // profile_idc
    profileCompat = readBits(5); // constraint_set[0-4]_flag, u(5)
    skipBits(3); // reserved_zero_3bits u(3),
    levelIdc = readUByte(); //level_idc u(8)
    skipUEG(); // seq_parameter_set_id
    // some profiles have more optional data we don't need
    if (profileIdc === 100 || profileIdc === 110 || profileIdc === 122 || profileIdc === 244 || profileIdc === 44 || profileIdc === 83 || profileIdc === 86 || profileIdc === 118 || profileIdc === 128) {
      var chromaFormatIdc = readUEG();
      if (chromaFormatIdc === 3) {
        skipBits(1); // separate_colour_plane_flag
      }
      skipUEG(); // bit_depth_luma_minus8
      skipUEG(); // bit_depth_chroma_minus8
      skipBits(1); // qpprime_y_zero_transform_bypass_flag
      if (readBoolean()) {
        // seq_scaling_matrix_present_flag
        scalingListCount = chromaFormatIdc !== 3 ? 8 : 12;
        for (i = 0; i < scalingListCount; i++) {
          if (readBoolean()) {
            // seq_scaling_list_present_flag[ i ]
            if (i < 6) {
              skipScalingList(16);
            } else {
              skipScalingList(64);
            }
          }
        }
      }
    }
    skipUEG(); // log2_max_frame_num_minus4
    var picOrderCntType = readUEG();
    if (picOrderCntType === 0) {
      readUEG(); //log2_max_pic_order_cnt_lsb_minus4
    } else if (picOrderCntType === 1) {
      skipBits(1); // delta_pic_order_always_zero_flag
      skipEG(); // offset_for_non_ref_pic
      skipEG(); // offset_for_top_to_bottom_field
      numRefFramesInPicOrderCntCycle = readUEG();
      for (i = 0; i < numRefFramesInPicOrderCntCycle; i++) {
        skipEG(); // offset_for_ref_frame[ i ]
      }
    }
    skipUEG(); // max_num_ref_frames
    skipBits(1); // gaps_in_frame_num_value_allowed_flag
    picWidthInMbsMinus1 = readUEG();
    picHeightInMapUnitsMinus1 = readUEG();
    frameMbsOnlyFlag = readBits(1);
    if (frameMbsOnlyFlag === 0) {
      skipBits(1); // mb_adaptive_frame_field_flag
    }
    skipBits(1); // direct_8x8_inference_flag
    if (readBoolean()) {
      // frame_cropping_flag
      frameCropLeftOffset = readUEG();
      frameCropRightOffset = readUEG();
      frameCropTopOffset = readUEG();
      frameCropBottomOffset = readUEG();
    }
    var pixelRatio = [1, 1];
    if (readBoolean()) {
      // vui_parameters_present_flag
      if (readBoolean()) {
        // aspect_ratio_info_present_flag
        var aspectRatioIdc = readUByte();
        switch (aspectRatioIdc) {
          case 1:
            pixelRatio = [1, 1];break;
          case 2:
            pixelRatio = [12, 11];break;
          case 3:
            pixelRatio = [10, 11];break;
          case 4:
            pixelRatio = [16, 11];break;
          case 5:
            pixelRatio = [40, 33];break;
          case 6:
            pixelRatio = [24, 11];break;
          case 7:
            pixelRatio = [20, 11];break;
          case 8:
            pixelRatio = [32, 11];break;
          case 9:
            pixelRatio = [80, 33];break;
          case 10:
            pixelRatio = [18, 11];break;
          case 11:
            pixelRatio = [15, 11];break;
          case 12:
            pixelRatio = [64, 33];break;
          case 13:
            pixelRatio = [160, 99];break;
          case 14:
            pixelRatio = [4, 3];break;
          case 15:
            pixelRatio = [3, 2];break;
          case 16:
            pixelRatio = [2, 1];break;
          case 255:
            {
              pixelRatio = [readUByte() << 8 | readUByte(), readUByte() << 8 | readUByte()];
              break;
            }
        }
      }
    }
    return {
      width: Math.ceil((picWidthInMbsMinus1 + 1) * 16 - frameCropLeftOffset * 2 - frameCropRightOffset * 2),
      height: (2 - frameMbsOnlyFlag) * (picHeightInMapUnitsMinus1 + 1) * 16 - (frameMbsOnlyFlag ? 2 : 4) * (frameCropTopOffset + frameCropBottomOffset),
      pixelRatio: pixelRatio
    };
  };

  ExpGolomb.prototype.readSliceType = function readSliceType() {
    // skip NALu type
    this.readUByte();
    // discard first_mb_in_slice
    this.readUEG();
    // return slice_type
    return this.readUEG();
  };

  return ExpGolomb;
}();

export default ExpGolomb;