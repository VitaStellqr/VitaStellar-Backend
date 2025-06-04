/* eslint-disable prettier/prettier */
/* eslint-disable no-console */
/* eslint-disable no-undef */
const { saveAndAnchorRecord, verifyRecord } = require('../services/recordService');

async function createRecord(req, res) {
  try {
    const { record, txHash } = await saveAndAnchorRecord(req.body);
    res.status(201).json({ id: record._id, stellarTxHash: txHash });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save and anchor record' });
  }
}

async function verifyRecordController(req, res) {
  try {
    const valid = await verifyRecord(req.params.id);
    res.json({ valid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Verification failed' });
  }
}

module.exports = {
  createRecord,
  verifyRecordController,
};
