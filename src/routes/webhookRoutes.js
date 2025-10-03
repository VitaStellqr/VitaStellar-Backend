/* eslint-disable prettier/prettier */
import express from 'express';
import { 
  handlePaymentWebhook, 
  getWebhookStatus 
} from '../controllers/webhookController.js';
import { 
  captureRawBody, 
  validateWebhookSignature, 
  webhookRateLimit 
} from '../middleware/webhookValidation.js';

const router = express.Router();

/**
 * @swagger
 * /payments/webhook:
 *   post:
 *     summary: Handle payment provider webhooks
 *     description: Securely process payment webhooks from various providers with HMAC validation and idempotency
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: false
 *         schema:
 *           type: string
 *           enum: [stripe, paypal, razorpay, flutterwave, paystack]
 *         description: Payment provider name
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Webhook payload from payment provider
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Webhook processed successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     webhookId:
 *                       type: string
 *                       example: "123e4567-e89b-12d3-a456-426614174000"
 *                     processingTime:
 *                       type: number
 *                       example: 150
 *       401:
 *         description: Invalid webhook signature
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Invalid webhook signature"
 *       500:
 *         description: Webhook processing failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Webhook processing failed"
 */
router.post('/webhook', 
  captureRawBody,
  webhookRateLimit,
  validateWebhookSignature('stripe'), // Default to stripe, can be overridden
  handlePaymentWebhook
);

/**
 * @swagger
 * /payments/webhook/{provider}:
 *   post:
 *     summary: Handle provider-specific payment webhooks
 *     description: Process webhooks for specific payment providers with provider-specific validation
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *           enum: [stripe, paypal, razorpay, flutterwave, paystack]
 *         description: Payment provider name
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Provider-specific webhook payload
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *       401:
 *         description: Invalid webhook signature
 *       500:
 *         description: Webhook processing failed
 */
router.post('/webhook/:provider',
  captureRawBody,
  webhookRateLimit,
  (req, res, next) => {
    // Set provider from route parameter
    req.params.provider = req.params.provider;
    next();
  },
  validateWebhookSignature('stripe'), // Will be overridden by provider-specific validation
  handlePaymentWebhook
);

/**
 * @swagger
 * /payments/webhook/status/{webhookId}:
 *   get:
 *     summary: Get webhook processing status
 *     description: Retrieve the processing status and details of a specific webhook
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: webhookId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Unique webhook identifier
 *     responses:
 *       200:
 *         description: Webhook status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     webhookId:
 *                       type: string
 *                       example: "123e4567-e89b-12d3-a456-426614174000"
 *                     status:
 *                       type: string
 *                       enum: [received, processing, processed, failed, duplicate]
 *                       example: "processed"
 *                     provider:
 *                       type: string
 *                       example: "stripe"
 *                     eventType:
 *                       type: string
 *                       example: "payment_intent.succeeded"
 *                     receivedAt:
 *                       type: string
 *                       format: date-time
 *                     processingDuration:
 *                       type: number
 *                       example: 150
 *                     errorMessage:
 *                       type: string
 *                       example: null
 *       404:
 *         description: Webhook not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Webhook not found"
 */
router.get('/webhook/status/:webhookId', getWebhookStatus);

export default router;
