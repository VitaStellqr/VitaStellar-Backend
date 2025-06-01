const mongoose = require('mongoose');

const transactionLogSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  recordId: { type: String, required: true },
  txHash: { type: String, required: true },
  timestamp: { type: Date, default: Date.now, index: true },
});

module.exports = mongoose.model('TransactionLog', transactionLogSchema);
