import express from 'express';
import logStellarTx from '../middleware/logStellarTx.js';
// import { yourAnchorLogic } from '../controllers/stellarController.js'; // Import the anchor logic function

const router = express.Router();

// Your existing Stellar anchoring route(s)
// router.post('/anchor', yourAnchorLogic);

// Attach the logging middleware AFTER your anchor logic
router.use('/anchor', logStellarTx);

export default router;
