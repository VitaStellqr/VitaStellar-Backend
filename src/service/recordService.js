/* eslint-disable prettier/prettier */
// src/services/recordService.js
import Record from '../models/Record.js';
import { sha256Hash } from '../utils/hashUtil.js';
import { submitTransaction, fetchMemoFromTransaction } from './stellarService.js';

export async function saveAndAnchorRecord(recordData) {
  // Create record without txHash
  const record = new Record({ ...recordData, txHash: 'pending' });
  await record.save();

  // Hash only selected fields (same as Stellar will see)
  const recordContent = {
    patientName: record.patientName,
    date: record.date,
    diagnosis: record.diagnosis,
    treatment: record.treatment,
    createdBy: record.createdBy.toString(),
  };

  const hash = sha256Hash(recordContent);

  // Submit hash to Stellar
  const stellarTxHash = await submitTransaction(hash);

  // Update record with txHash
  record.txHash = stellarTxHash;
  await record.save();

  return { record, txHash: stellarTxHash };
}

export async function verifyRecord(recordId) {
  const record = await Record.findById(recordId).lean();
  if (!record) throw new Error('Record not found');

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
