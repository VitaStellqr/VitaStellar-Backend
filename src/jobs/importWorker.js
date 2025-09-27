/* eslint-disable prettier/prettier */
import { Worker } from 'bullmq';
import fs from 'fs';
import csv from 'csv-parse';
import ImportJob from '../models/importJob.js';
import { validateRow } from '../validators/importValidator.js';
import Patient from '../models/Patient.js';

export const worker = new Worker('csv-import', async job => {
  const jobRecord = await ImportJob.findById(job.data.jobId);
  if (!jobRecord) return;

  jobRecord.status = 'processing';
  await jobRecord.save();

  let success = 0,
    errors = [];
  const parser = fs.createReadStream(jobRecord.filePath).pipe(csv({ columns: true }));
  let rowNum = 0;

  for await (const record of parser) {
    rowNum++;
    const validation = validateRow(record);
    if (!validation.success) {
      errors.push({ row: rowNum, errors: validation.errors, data: record });
      continue;
    }

    try {
      await Patient.create(validation.data);
      success++;
    } catch (err) {
      errors.push({ row: rowNum, errors: [err.message], data: record });
    }
  }

  jobRecord.status = 'completed';
  jobRecord.successCount = success;
  jobRecord.errorCount = errors.length;

  if (errors.length) {
    const errorPath = `reports/errors-${job.data.jobId}.json`;
    fs.writeFileSync(errorPath, JSON.stringify(errors, null, 2));
    jobRecord.errorReportPath = errorPath;
  }

  await jobRecord.save();
});
