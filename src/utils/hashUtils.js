/* eslint-disable prettier/prettier */
/* eslint-disable no-undef */
// src/utils/hashUtil.js
const crypto = require('crypto');

function sha256Hash(data) {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

module.exports = { sha256Hash };
