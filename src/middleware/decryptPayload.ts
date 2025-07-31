import { decrypt } from '../utils/crypto.util.js';

const FIELDS_TO_DECRYPT = ['diagnosis', 'treatment', 'history'];

function decryptPayload(req, res, next) {
  res.decryptRecord = (record) => {
    try {
      if (!record) return record;
      const decryptedRecord = { ...record._doc || record }; // support Mongoose docs
      FIELDS_TO_DECRYPT.forEach((field) => {
        if (decryptedRecord[field] && typeof decryptedRecord[field] === 'string') {
          decryptedRecord[field] = decrypt(decryptedRecord[field]);
        }
      });
      return decryptedRecord;
    } catch (err) {
      console.error('Decryption failed:', err.message);
      throw new Error('Decryption failed: ' + err.message);
    }
  };
  
  res.decryptRecords = (records) => {
    try {
      if (!Array.isArray(records)) return records;
      return records.map(record => res.decryptRecord(record));
    } catch (err) {
      console.error('Bulk decryption failed:', err.message);
      throw new Error('Bulk decryption failed: ' + err.message);
    }
  };
  
  next();
}

export default decryptPayload;
