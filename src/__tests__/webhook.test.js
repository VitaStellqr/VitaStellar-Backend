/* eslint-disable prettier/prettier */
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../index.js';
import Payment from '../models/Payment.js';
import WebhookLog from '../models/WebhookLog.js';
import crypto from 'crypto';

// Mock environment variables
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'test_razorpay_secret';
process.env.PAYSTACK_WEBHOOK_SECRET = 'test_paystack_secret';
process.env.FLUTTERWAVE_WEBHOOK_SECRET = 'test_flutterwave_secret';
process.env.PAYPAL_WEBHOOK_SECRET = 'test_paypal_secret';

describe('Payment Webhook Handler', () => {
  let testUserId;
  
  beforeAll(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/uzima_test');
    }
    
    // Create test user
    const User = mongoose.model('User', new mongoose.Schema({
      username: String,
      email: String,
      role: String
    }));
    
    const user = new User({
      username: 'testuser',
      email: 'test@example.com',
      role: 'patient'
    });
    
    const savedUser = await user.save();
    testUserId = savedUser._id;
  });

  afterAll(async () => {
    // Clean up test data
    await Payment.deleteMany({});
    await WebhookLog.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clean up before each test
    await Payment.deleteMany({});
    await WebhookLog.deleteMany({});
  });

  describe('POST /payments/webhook', () => {
    it('should process Stripe payment_intent.succeeded webhook successfully', async () => {
      const stripePayload = {
        id: 'evt_test_webhook',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_payment_intent',
            amount: 2000, // $20.00 in cents
            currency: 'usd',
            status: 'succeeded',
            description: 'Test payment',
            metadata: {
              userId: testUserId.toString()
            }
          }
        }
      };

      const signature = generateStripeSignature(JSON.stringify(stripePayload));

      const response = await request(app)
        .post('/payments/webhook')
        .set('stripe-signature', signature)
        .set('Content-Type', 'application/json')
        .send(stripePayload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Webhook processed successfully');
      expect(response.body.data.webhookId).toBeDefined();
      expect(response.body.data.processingTime).toBeDefined();

      // Verify payment was created
      const payment = await Payment.findOne({ providerPaymentId: 'pi_test_payment_intent' });
      expect(payment).toBeTruthy();
      expect(payment.provider).toBe('stripe');
      expect(payment.amount).toBe(20.00);
      expect(payment.currency).toBe('USD');
      expect(payment.status).toBe('completed');
      expect(payment.userId.toString()).toBe(testUserId.toString());

      // Verify webhook log was created
      const webhookLog = await WebhookLog.findOne({ eventId: 'evt_test_webhook' });
      expect(webhookLog).toBeTruthy();
      expect(webhookLog.provider).toBe('stripe');
      expect(webhookLog.eventType).toBe('payment_intent.succeeded');
      expect(webhookLog.status).toBe('processed');
    });

    it('should handle duplicate webhooks idempotently', async () => {
      const stripePayload = {
        id: 'evt_duplicate_webhook',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_duplicate_payment',
            amount: 1000,
            currency: 'usd',
            status: 'succeeded',
            description: 'Duplicate payment test'
          }
        }
      };

      const signature = generateStripeSignature(JSON.stringify(stripePayload));

      // First webhook
      const firstResponse = await request(app)
        .post('/payments/webhook')
        .set('stripe-signature', signature)
        .set('Content-Type', 'application/json')
        .send(stripePayload);

      expect(firstResponse.status).toBe(200);

      // Second webhook (duplicate)
      const secondResponse = await request(app)
        .post('/payments/webhook')
        .set('stripe-signature', signature)
        .set('Content-Type', 'application/json')
        .send(stripePayload);

      expect(secondResponse.status).toBe(200);
      expect(secondResponse.body.message).toBe('Webhook already processed');

      // Verify only one payment was created
      const payments = await Payment.find({ providerPaymentId: 'pi_duplicate_payment' });
      expect(payments).toHaveLength(1);

      // Verify webhook logs
      const webhookLogs = await WebhookLog.find({ eventId: 'evt_duplicate_webhook' });
      expect(webhookLogs).toHaveLength(2);
      expect(webhookLogs[1].status).toBe('duplicate');
    });

    it('should process Razorpay payment.captured webhook successfully', async () => {
      const razorpayPayload = {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_razorpay_test',
              amount: 100000, // ₹1000.00 in paise
              currency: 'INR',
              status: 'captured',
              description: 'Razorpay test payment',
              notes: {
                userId: testUserId.toString()
              }
            }
          }
        }
      };

      const signature = generateRazorpaySignature(JSON.stringify(razorpayPayload));

      const response = await request(app)
        .post('/payments/webhook/razorpay')
        .set('x-razorpay-signature', signature)
        .set('Content-Type', 'application/json')
        .send(razorpayPayload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify payment was created
      const payment = await Payment.findOne({ providerPaymentId: 'pay_razorpay_test' });
      expect(payment).toBeTruthy();
      expect(payment.provider).toBe('razorpay');
      expect(payment.amount).toBe(1000.00);
      expect(payment.currency).toBe('INR');
      expect(payment.status).toBe('completed');
    });

    it('should process Paystack charge.success webhook successfully', async () => {
      const paystackPayload = {
        event: 'charge.success',
        data: {
          id: 'paystack_test_charge',
          amount: 50000, // ₦500.00 in kobo
          currency: 'NGN',
          status: 'success',
          reference: 'paystack_test_ref',
          metadata: {
            userId: testUserId.toString()
          }
        }
      };

      const signature = generatePaystackSignature(JSON.stringify(paystackPayload));

      const response = await request(app)
        .post('/payments/webhook/paystack')
        .set('x-paystack-signature', signature)
        .set('Content-Type', 'application/json')
        .send(paystackPayload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify payment was created
      const payment = await Payment.findOne({ providerPaymentId: 'paystack_test_charge' });
      expect(payment).toBeTruthy();
      expect(payment.provider).toBe('paystack');
      expect(payment.amount).toBe(500.00);
      expect(payment.currency).toBe('NGN');
      expect(payment.status).toBe('completed');
    });

    it('should handle payment failures correctly', async () => {
      const stripePayload = {
        id: 'evt_failed_payment',
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_failed_payment',
            amount: 1500,
            currency: 'usd',
            status: 'requires_payment_method',
            description: 'Failed payment test',
            last_payment_error: {
              message: 'Your card was declined.'
            }
          }
        }
      };

      const signature = generateStripeSignature(JSON.stringify(stripePayload));

      const response = await request(app)
        .post('/payments/webhook')
        .set('stripe-signature', signature)
        .set('Content-Type', 'application/json')
        .send(stripePayload);

      expect(response.status).toBe(200);

      // Verify payment was created with failed status
      const payment = await Payment.findOne({ providerPaymentId: 'pi_failed_payment' });
      expect(payment).toBeTruthy();
      expect(payment.status).toBe('failed');
      expect(payment.failureReason).toBe('Your card was declined.');
    });

    it('should reject webhooks with invalid signatures', async () => {
      const stripePayload = {
        id: 'evt_invalid_signature',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_invalid_signature',
            amount: 1000,
            currency: 'usd',
            status: 'succeeded'
          }
        }
      };

      const response = await request(app)
        .post('/payments/webhook')
        .set('stripe-signature', 'invalid_signature')
        .set('Content-Type', 'application/json')
        .send(stripePayload);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid webhook signature');
    });

    it('should reject webhooks without signatures', async () => {
      const stripePayload = {
        id: 'evt_no_signature',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_no_signature',
            amount: 1000,
            currency: 'usd',
            status: 'succeeded'
          }
        }
      };

      const response = await request(app)
        .post('/payments/webhook')
        .set('Content-Type', 'application/json')
        .send(stripePayload);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Missing webhook signature');
    });

    it('should handle webhook processing errors gracefully', async () => {
      // Mock a webhook that will cause processing to fail
      const invalidPayload = {
        id: 'evt_invalid_payload',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            // Missing required fields to cause processing failure
          }
        }
      };

      const signature = generateStripeSignature(JSON.stringify(invalidPayload));

      const response = await request(app)
        .post('/payments/webhook')
        .set('stripe-signature', signature)
        .set('Content-Type', 'application/json')
        .send(invalidPayload);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Webhook processing failed');
    });
  });

  describe('GET /payments/webhook/status/:webhookId', () => {
    it('should return webhook status for valid webhook ID', async () => {
      // First create a webhook log
      const webhookLog = new WebhookLog({
        webhookId: 'test-webhook-id',
        provider: 'stripe',
        eventType: 'payment_intent.succeeded',
        eventId: 'evt_test_status',
        signature: 'test_signature',
        signatureValid: true,
        rawPayload: '{"test": "payload"}',
        parsedPayload: { test: 'payload' },
        ipAddress: '127.0.0.1',
        status: 'processed',
        receivedAt: new Date()
      });

      await webhookLog.save();

      const response = await request(app)
        .get('/payments/webhook/status/test-webhook-id');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.webhookId).toBe('test-webhook-id');
      expect(response.body.data.status).toBe('processed');
      expect(response.body.data.provider).toBe('stripe');
      expect(response.body.data.eventType).toBe('payment_intent.succeeded');
    });

    it('should return 404 for non-existent webhook ID', async () => {
      const response = await request(app)
        .get('/payments/webhook/status/non-existent-id');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Webhook not found');
    });
  });

  describe('Payment Model Tests', () => {
    it('should create payment with correct status transitions', async () => {
      const payment = new Payment({
        paymentId: crypto.randomUUID(),
        provider: 'stripe',
        providerPaymentId: 'pi_test_transitions',
        amount: 1000,
        currency: 'USD',
        status: 'pending',
        userId: testUserId,
        description: 'Test payment transitions'
      });

      await payment.save();

      // Test valid status transition
      await payment.updateStatus('processing');
      expect(payment.status).toBe('processing');

      await payment.updateStatus('completed');
      expect(payment.status).toBe('completed');
      expect(payment.completedAt).toBeDefined();

      // Test invalid status transition
      await expect(payment.updateStatus('pending')).rejects.toThrow();
    });

    it('should prevent duplicate payments with same provider and ID', async () => {
      const paymentData = {
        paymentId: crypto.randomUUID(),
        provider: 'stripe',
        providerPaymentId: 'pi_duplicate_test',
        amount: 1000,
        currency: 'USD',
        status: 'completed',
        userId: testUserId
      };

      const payment1 = new Payment(paymentData);
      await payment1.save();

      const payment2 = new Payment({
        ...paymentData,
        paymentId: crypto.randomUUID() // Different payment ID but same provider payment ID
      });

      await expect(payment2.save()).rejects.toThrow();
    });
  });

  describe('WebhookLog Model Tests', () => {
    it('should mark webhook as processing correctly', async () => {
      const webhookLog = new WebhookLog({
        webhookId: crypto.randomUUID(),
        provider: 'stripe',
        eventType: 'payment_intent.succeeded',
        eventId: 'evt_test_processing',
        signature: 'test_signature',
        signatureValid: true,
        rawPayload: '{"test": "payload"}',
        parsedPayload: { test: 'payload' },
        ipAddress: '127.0.0.1',
        status: 'received'
      });

      await webhookLog.save();
      await webhookLog.markAsProcessing();

      expect(webhookLog.status).toBe('processing');
      expect(webhookLog.processingStartedAt).toBeDefined();
    });

    it('should mark webhook as processed correctly', async () => {
      const webhookLog = new WebhookLog({
        webhookId: crypto.randomUUID(),
        provider: 'stripe',
        eventType: 'payment_intent.succeeded',
        eventId: 'evt_test_processed',
        signature: 'test_signature',
        signatureValid: true,
        rawPayload: '{"test": "payload"}',
        parsedPayload: { test: 'payload' },
        ipAddress: '127.0.0.1',
        status: 'processing'
      });

      await webhookLog.save();
      await webhookLog.markAsProcessed();

      expect(webhookLog.status).toBe('processed');
      expect(webhookLog.processingCompletedAt).toBeDefined();
    });

    it('should handle webhook failures with retry logic', async () => {
      const webhookLog = new WebhookLog({
        webhookId: crypto.randomUUID(),
        provider: 'stripe',
        eventType: 'payment_intent.succeeded',
        eventId: 'evt_test_failure',
        signature: 'test_signature',
        signatureValid: true,
        rawPayload: '{"test": "payload"}',
        parsedPayload: { test: 'payload' },
        ipAddress: '127.0.0.1',
        status: 'processing'
      });

      await webhookLog.save();
      await webhookLog.markAsFailed('Test error message');

      expect(webhookLog.status).toBe('failed');
      expect(webhookLog.errorMessage).toBe('Test error message');
      expect(webhookLog.retryCount).toBe(1);
      expect(webhookLog.nextRetryAt).toBeDefined();
    });
  });
});

// Helper functions for generating test signatures
function generateStripeSignature(payload) {
  const timestamp = Math.floor(Date.now() / 1000);
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(timestamp + '.' + payload)
    .digest('hex');
  
  return `t=${timestamp},v1=${signature}`;
}

function generateRazorpaySignature(payload) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

function generatePaystackSignature(payload) {
  const secret = process.env.PAYSTACK_WEBHOOK_SECRET;
  return crypto
    .createHmac('sha512', secret)
    .update(payload)
    .digest('hex');
}
