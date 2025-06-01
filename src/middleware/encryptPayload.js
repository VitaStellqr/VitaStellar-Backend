const { encrypt } = require('../utils/crypto');

module.exports = function encryptPayload(req, res, next) {
  try {
    const fieldsToEncrypt = ['diagnosis', 'treatment', 'history'];
    for (const field of fieldsToEncrypt) {
      if (req.body[field]) {
        req.body[field] = encrypt(req.body[field]);
      }
    }
    next();
  } catch (err) {
    console.error('Encryption failed:', err);
    res.status(500).json({ message: 'Encryption error' });
  }
};
