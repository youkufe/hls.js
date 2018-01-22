function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

import AESCrypto from './aes-crypto';
import FastAESKey from './fast-aes-key';
import AESDecryptor from './aes-decryptor';

import { ErrorTypes, ErrorDetails } from '../errors';
import { logger } from '../utils/logger';

/*globals self: false */

var Decrypter = function () {
  function Decrypter(observer, config) {
    _classCallCheck(this, Decrypter);

    this.observer = observer;
    this.config = config;
    this.logEnabled = true;
    try {
      var browserCrypto = crypto ? crypto : self.crypto;
      this.subtle = browserCrypto.subtle || browserCrypto.webkitSubtle;
    } catch (e) {}
    this.disableWebCrypto = !this.subtle;
  }

  Decrypter.prototype.isSync = function isSync() {
    return this.disableWebCrypto && this.config.enableSoftwareAES;
  };

  Decrypter.prototype.decrypt = function decrypt(data, key, iv, callback) {
    var _this = this;

    if (this.disableWebCrypto && this.config.enableSoftwareAES) {
      if (this.logEnabled) {
        logger.log('JS AES decrypt');
        this.logEnabled = false;
      }
      var decryptor = this.decryptor;
      if (!decryptor) {
        this.decryptor = decryptor = new AESDecryptor();
      }
      decryptor.expandKey(key);
      callback(decryptor.decrypt(data, 0, iv));
    } else {
      if (this.logEnabled) {
        logger.log('WebCrypto AES decrypt');
        this.logEnabled = false;
      }
      var subtle = this.subtle;
      if (this.key !== key) {
        this.key = key;
        this.fastAesKey = new FastAESKey(subtle, key);
      }

      this.fastAesKey.expandKey().then(function (aesKey) {
        // decrypt using web crypto
        var crypto = new AESCrypto(subtle, iv);
        crypto.decrypt(data, aesKey).catch(function (err) {
          _this.onWebCryptoError(err, data, key, iv, callback);
        }).then(function (result) {
          callback(result);
        });
      }).catch(function (err) {
        _this.onWebCryptoError(err, data, key, iv, callback);
      });
    }
  };

  Decrypter.prototype.onWebCryptoError = function onWebCryptoError(err, data, key, iv, callback) {
    if (this.config.enableSoftwareAES) {
      logger.log('WebCrypto Error, disable WebCrypto API');
      this.disableWebCrypto = true;
      this.logEnabled = true;
      this.decrypt(data, key, iv, callback);
    } else {
      logger.error('decrypting error : ' + err.message);
      this.observer.trigger(Event.ERROR, { type: ErrorTypes.MEDIA_ERROR, details: ErrorDetails.FRAG_DECRYPT_ERROR, fatal: true, reason: err.message });
    }
  };

  Decrypter.prototype.destroy = function destroy() {
    var decryptor = this.decryptor;
    if (decryptor) {
      decryptor.destroy();
      this.decryptor = undefined;
    }
  };

  return Decrypter;
}();

export default Decrypter;