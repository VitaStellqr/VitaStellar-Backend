/* eslint-disable prettier/prettier */
// src/service/recordService.js
import Record from '../models/Record.js';
import Outbox from '../models/Outbox.js';
import { sha256Hash } from '../utils/hashUtils.js';
import { fetchMemoFromTransaction } from './stellarService.js';
import { withTransaction } from '../utils/withTransaction.js';

// Create record and enqueue Stellar anchoring via Outbox pattern
export async function saveAndAnchorRecord(recordData) {
  let record;
  await withTransaction(async (session) => {
    record = new Record({ ...recordData, txHash: 'pending' });
    await record.save({ session });
    // Outbox job - the worker will compute the hash and submit to Stellar
    await Outbox.create([
      {
        type: 'stellar.anchor',
        payload: { recordId: record._id.toString() },
        idempotencyKey: record._id.toString(),
        status: 'pending',
      }
    ], { session });
  });
  // Return 202-like response shape; tx will be filled asynchronously
  return { record, txHash: 'pending' };
}

export async function verifyRecord(recordId) {
  const record = await Record.findById(recordId).lean();
  if (!record) throw new Error('Record not found');
  if (!record.txHash || record.txHash === 'pending') return false;

  const onChainMemo = await fetchMemoFromTransaction(record.txHash);

  const recordContent = {
    patientName: record.patientName,
    date: record.date,
    diagnosis: record.diagnosis,
    treatment: record.treatment,
    createdBy: record.createdBy.toString(),
  };

  const localHash = sha256Hash(recordContent);

  return localHash === onChainMemo;
}
