const express = require('express');
const router = express.Router();
const encryptPayload = require('../middleware/encryptPayload');
const decryptPayload = require('../middleware/decryptPayload');
const { Record } = require('../typeorm/entity/Record'); // Example path

// POST - Create
router.post('/records', encryptPayload, async (req, res) => {
  try {
    const record = await Record.save(req.body);
    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ message: 'Failed to save record' });
  }
});

// PUT - Update
router.put('/records/:id', encryptPayload, async (req, res) => {
  try {
    await Record.update(req.params.id, req.body);
    res.status(200).json({ message: 'Record updated' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update record' });
  }
});

// GET - Fetch
router.get('/records/:id', decryptPayload, async (req, res) => {
  try {
    const record = await Record.findOneBy({ id: req.params.id });
    if (!record) return res.status(404).json({ message: 'Record not found' });

    // Optional: auth check before decryption
    const decrypted = res.decryptRecord(record);
    res.json(decrypted);
  } catch (err) {
    res.status(500).json({ message: 'Failed to retrieve record' });
  }
});

module.exports = router;
