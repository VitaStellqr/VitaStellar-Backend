const { decrypt } = require('../utils/crypto.util');

const FIELDS_TO_DECRYPT = ['diagnosis', 'treatment', 'history'];

function decryptPayload(req, res, next) {
  res.decryptRecord = (record) => {
    try {
      if (!record) return record;
      const decryptedRecord = { ...record._doc || record }; // support Mongoose docs
      FIELDS_TO_DECRYPT.forEach((field) => {
        if (decryptedRecord[field]) {
          decryptedRecord[field] = decrypt(decryptedRecord[field]);
        }
      });
      return decryptedRecord;
    } catch (err) {
      throw new Error('Decryption failed: ' + err.message);
    }
  };
  next();
}

module.exports = decryptPayload;
