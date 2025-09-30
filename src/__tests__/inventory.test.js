/* eslint-disable prettier/prettier */
import request from 'supertest';
import app from '../index.js';
import mongoose from 'mongoose';
import InventoryItem from '../models/InventoryItem.js';

describe('Inventory FIFO and Low-Stock', () => {
  beforeAll(async () => {
    await mongoose.connection.dropDatabase();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  test('FIFO consumption honors earliest expiry', async () => {
    await request(app).post('/api/inventory').send({ sku: 'GLOVES-001', name: 'Gloves', threshold: 5 });
    await request(app).post('/api/inventory/GLOVES-001/lots').send({ lotNumber: 'A', quantity: 10, expiryDate: '2026-01-01' });
    await request(app).post('/api/inventory/GLOVES-001/lots').send({ lotNumber: 'B', quantity: 5, expiryDate: '2025-01-01' });

    const consumeRes = await request(app).post('/api/inventory/GLOVES-001/consume').send({ quantity: 6 });
    expect(consumeRes.status).toBe(200);
    const lotsConsumed = consumeRes.body.data.lotsConsumed;
    // Expect it to consume from lot B (earlier expiry) first
    const first = lotsConsumed[0];
    expect(first.lotNumber).toBe('B');
  });

  test('Low-stock alert condition when below threshold', async () => {
    const item = await InventoryItem.findOne({ sku: 'GLOVES-001' });
    expect(item.totalQuantity).toBeLessThanOrEqual(item.threshold);
  });
});


