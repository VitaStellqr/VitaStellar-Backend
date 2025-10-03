import request from 'supertest';
import app from '../index.js';

describe('Centralized Error Handling', () => {
  test('Returns standardized error shape and correlationId', async () => {
    // This route does not exist, should trigger 404
    const res = await request(app).get('/nonexistent-route');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('code');
    expect(res.body).toHaveProperty('message');
    expect(res.body).toHaveProperty('correlationId');
    expect(typeof res.body.correlationId).toBe('string');
    expect(res.headers).toHaveProperty('x-correlation-id');
    expect(res.body.correlationId).toBe(res.headers['x-correlation-id']);
  });

  test('Error shape for thrown error', async () => {
    const res = await request(app).get('/debug-sentry');
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('code');
    expect(res.body).toHaveProperty('message');
    expect(res.body).toHaveProperty('correlationId');
    expect(typeof res.body.correlationId).toBe('string');
    expect(res.headers).toHaveProperty('x-correlation-id');
    expect(res.body.correlationId).toBe(res.headers['x-correlation-id']);
  });
});
