/* eslint-disable prettier/prettier */
import mongoose from 'mongoose';
import Record from '../models/Record.js';
import User from '../models/User.js';
import transactionLog from '../models/transactionLog.js';
import recordController from '../controllers/recordController.js';
import { syncRecords } from '../controllers/sync.controller.js';

function mockRes() {
  const res = {};
  res.statusCode = 200;
  res.status = code => { res.statusCode = code; return res; };
  res.jsonPayload = null;
  res.json = payload => { res.jsonPayload = payload; return res; };
  res.send = payload => { res.jsonPayload = payload; return res; };
  return res;
}

function mockReq(params = {}, body = {}, user = null, query = {}) {
  return { params, body, user, query };
}

describe('Atomic multi-document transactions', () => {
  test('restoreRecord rolls back when audit log write fails', async () => {
    const user = await User.create({ username: 'doc', email: 'd@x.com', password: 'x', role: 'doctor' });
    const createdBy = new mongoose.Types.ObjectId();
    const rec = await Record.create({
      patientName: 'p1', diagnosis: 'd', treatment: 't', txHash: 'x',
      clientUUID: 'c1', syncTimestamp: new Date(), createdBy,
      deletedAt: new Date(),
    });

    // Spy to force failure after record save inside transaction
    const spy = jest.spyOn(transactionLog, 'create').mockImplementation(() => { throw new Error('fail'); });

    const req = mockReq({ id: rec._id.toString() }, {}, { _id: user._id });
    const res = mockRes();
    await recordController.restoreRecord(req, res);

    // Expect error and that record remains deleted
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    const fresh = await Record.findById(rec._id).lean();
    expect(fresh.deletedAt).not.toBeNull();

    spy.mockRestore();
  });

  test('purgeRecord rolls back when audit log write fails', async () => {
    const user = await User.create({ username: 'admin', email: 'a@x.com', password: 'x', role: 'admin' });
    const createdBy = new mongoose.Types.ObjectId();
    const rec = await Record.create({
      patientName: 'p2', diagnosis: 'd', treatment: 't', txHash: 'x',
      clientUUID: 'c2', syncTimestamp: new Date(), createdBy,
      deletedAt: new Date(),
    });

    const spy = jest.spyOn(transactionLog, 'create').mockImplementation(() => { throw new Error('fail'); });

    const req = mockReq({ id: rec._id.toString() }, {}, { _id: user._id });
    const res = mockRes();
    await recordController.purgeRecord(req, res);

    // Expect error and that record still exists
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    const exists = await Record.findById(rec._id);
    expect(exists).not.toBeNull();

    spy.mockRestore();
  });

  test('syncRecords is all-or-nothing for batch insert', async () => {
    // create creator user id to satisfy schema
    const creatorId = new mongoose.Types.ObjectId();

    const now = new Date();
    const dupClientUUID = 'dup-uuid';
    const body = [
      { clientUUID: dupClientUUID, syncTimestamp: now.toISOString(), patientName: 'p1', diagnosis: 'd', treatment: 't', createdBy: creatorId.toString() },
      { clientUUID: dupClientUUID, syncTimestamp: now.toISOString(), patientName: 'p2', diagnosis: 'd2', treatment: 't2', createdBy: creatorId.toString() },
    ];

    const req = mockReq({}, body);
    const res = mockRes();

    await syncRecords(req, res);

    // Expect failure due to duplicate key and no inserts persisted
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    const count = await Record.countDocuments({ clientUUID: dupClientUUID });
    expect(count).toBe(0);
  });
});
