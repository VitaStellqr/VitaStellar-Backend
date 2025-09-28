/* eslint-disable prettier/prettier */
/* eslint-disable no-undef */
import express from 'express';
import { createRecord, verifyRecordController } from '../controllers/recordsController.js';

const router = express.Router();

router.post('/', createRecord);
router.get('/:id/verify', verifyRecordController);

export default router;
