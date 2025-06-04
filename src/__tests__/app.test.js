/* eslint-disable prettier/prettier */
import request from 'supertest';
import express from 'express';

// Basic app setup for testing
const app = express();
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

describe('Health Check', () => {
  test('GET /health should return 200', async () => {
    const response = await request(app).get('/health').expect(200);

    expect(response.body.status).toBe('OK');
  });
});
