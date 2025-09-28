import express from 'express';
import TransactionLog from '../models/transactionLog.js';
const router = express.Router();

router.get('/logs', async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId query parameter is required' });
  }

  try {
    const logs = await TransactionLog.find({ userId }).sort({ timestamp: -1 });
    res.json(logs);
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
