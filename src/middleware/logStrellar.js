const TransactionLog = require('../models/transactionLog');

const logStellarTx = async (req, res, next) => {
  const originalSend = res.send;

  res.send = async function (body) {
    try {
      // Assuming the response body contains the anchoring transaction details as JSON
      // Parse if body is a string
      let data = body;
      if (typeof body === 'string') {
        try {
          data = JSON.parse(body);
        } catch (err) {
          // If not JSON, skip logging
          return originalSend.call(this, body);
        }
      }

      // Extract transaction details - adapt these based on your actual response format
      const { userId, recordId, txHash } = data;

      if (userId && recordId && txHash) {
        const logEntry = new TransactionLog({ userId, recordId, txHash });
        await logEntry.save();
      }
    } catch (error) {
      console.error('Error logging Stellar transaction:', error);
      // Do not block response even if logging fails
    }

    return originalSend.call(this, body);
  };

  next();
};

module.exports = logStellarTx;
