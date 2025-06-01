const { decrypt } = require('../utils/crypto.util'); // adjust path if needed

function decryptPayload(req, res, next) {
  res.decryptRecord = function (record) {
    try {
      const decrypted = { ...record };
      ['diagnosis', 'treatment', 'history'].forEach((field) => {
        if (decrypted[field]) {
          decrypted[field] = decrypt(decrypted[field]);
        }
      });
      return decrypted;
    } catch (err) {
      throw new Error('Decryption failed');
    }
  };
  next();
}

module.exports = decryptPayload;
