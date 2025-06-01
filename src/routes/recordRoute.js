const express = require('express');
const encryptPayload = require('./middleware/encryptPayload');
const decryptPayload = require('./middleware/decryptPayload');
const Record = require('./models/Record');
const router = express.Router();

router.post('/records', encryptPayload, async (req, res, next) => {
  try {
    const record = new Record(req.body);
    await record.save();
    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
});

router.put('/records/:id', encryptPayload, async (req, res, next) => {
  try {
    const record = await Record.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!record) return res.status(404).send('Record not found');
    res.json(record);
  } catch (err) {
    next(err);
  }
});

router.get('/records/:id', decryptPayload, async (req, res, next) => {
  try {
    const record = await Record.findById(req.params.id);
    if (!record) return res.status(404).send('Record not found');
    const decrypted = res.decryptRecord(record);
    res.json(decrypted);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
