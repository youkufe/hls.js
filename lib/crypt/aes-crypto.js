function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var AESCrypto = function () {
  function AESCrypto(subtle, iv) {
    _classCallCheck(this, AESCrypto);

    this.subtle = subtle;
    this.aesIV = iv;
  }

  AESCrypto.prototype.decrypt = function decrypt(data, key) {
    return this.subtle.decrypt({ name: 'AES-CBC', iv: this.aesIV }, key, data);
  };

  return AESCrypto;
}();

export default AESCrypto;