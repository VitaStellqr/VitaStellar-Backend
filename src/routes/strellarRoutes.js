const express = require('express');
const logStellarTx = require('../middleware/logStellarTx');
const router = express.Router();

// Your existing Stellar anchoring route(s)
router.post('/anchor', yourAnchorLogic);

// Attach the logging middleware AFTER your anchor logic
router.use('/anchor', logStellarTx);

module.exports = router;
