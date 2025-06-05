import express from 'express';
import { syncRecords } from '../controllers/sync.controller.js';

const router = express.Router();

router.post('/sync', syncRecords);

export default router;
