/* eslint-disable prettier/prettier */
/* eslint-disable no-undef */
const express = require('express');
const router = express.Router();
const { createRecord, verifyRecordController } = require('../controllers/recordsController');

router.post('/', createRecord);
router.get('/:id/verify', verifyRecordController);

module.exports = router;
