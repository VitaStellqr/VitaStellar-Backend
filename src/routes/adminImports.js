/* eslint-disable prettier/prettier */
import express from 'express';
import multer from 'multer';
import csv from 'csv-parse';
import fs from 'fs';
import ImportJob from '../models/importJob.js';
import { validateRow } from '../validators/importValidator.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Upload CSV
router.post('/csv', upload.single('file'), async (req, res) => {
  const job = await ImportJob.create({
    filePath: req.file.path,
    status: 'pending',
    createdBy: req.user._id,
  });
  res.json({ jobId: job._id });
});

// Preview first N rows
router.get('/:id/preview', async (req, res) => {
  const job = await ImportJob.findById(req.params.id);
  if (!job) return res.status(404).json({ message: 'Job not found' });

  const rows = [];
  const errors = [];
  const parser = fs.createReadStream(job.filePath).pipe(csv({ columns: true }));

  let count = 0;
  for await (const record of parser) {
    if (count >= 10) break; // preview first 10 rows
    const validation = validateRow(record);
    if (!validation.success) {
      errors.push({ row: count + 1, errors: validation.errors });
    }
    rows.push(record);
    count++;
  }

  res.json({ preview: rows, errors });
});

export default router;
