/* eslint-disable prettier/prettier */
import crypto from 'crypto';
import Payment from '../models/Payment.js';
import WebhookLog from '../models/WebhookLog.js';
import ApiResponse from '../utils/ApiResponse.js';
import { withTransaction } from '../utils/withTransaction.js';

/**
 * Main webhook handler for payment providers
 * Handles webhooks securely and idempotently
 */
export const handlePaymentWebhook = async (req, res) => {
  const startTime = Date.now();
  let webhookLog = null;
  
  try {
    // Extract provider from route or headers
    const provider = req.params.provider || req.headers['x-provider'] || 'stripe';
    
    // Generate unique webhook ID
    const webhookId = crypto.randomUUID();
    const requestId = req.headers['x-request-id'] || crypto.randomUUID();
    
    // Get client information
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    // Create webhook log entry
    webhookLog = new WebhookLog({
      webhookId,
      provider,
      eventType: req.body.type || req.body.event || 'unknown',
      eventId: req.body.id || req.body.data?.id || 'unknown',
      requestId,
      signature: req.headers['x-webhook-signature'] || req.headers['stripe-signature'] || 'unknown',
      signatureValid: req.webhookValidation?.validated || false,
      rawPayload: req.rawBody || JSON.stringify(req.body),
      parsedPayload: req.body,
      ipAddress,
      userAgent,
      status: 'received'
    });
    
    await webhookLog.save();
    
    // Check for duplicate webhook
    const existingWebhook = await WebhookLog.findByProviderAndEventId(provider, webhookLog.eventId);
    if (existingWebhook && existingWebhook.status === 'processed') {
      webhookLog.markAsDuplicate();
      return ApiResponse.success(res, { message: 'Webhook already processed' }, 'Webhook already processed', 200);
    }
    
    // Mark as processing
    await webhookLog.markAsProcessing();
    
    // Process the webhook based on provider and event type
    const result = await processWebhookEvent(provider, req.body, webhookLog);
    
    // Mark as processed
    await webhookLog.markAsProcessed(result.paymentId);
    
    const processingTime = Date.now() - startTime;
    console.log(`Webhook processed successfully in ${processingTime}ms`);
    
    return ApiResponse.success(res, { 
      message: 'Webhook processed successfully',
      webhookId,
      processingTime 
    }, 'Webhook processed successfully', 200);
    
  } catch (error) {
    console.error('Webhook processing error:', error);
    
    if (webhookLog) {
      await webhookLog.markAsFailed(error.message, error.stack);
    }
    
    return ApiResponse.error(res, 'Webhook processing failed', 500);
  }
};

/**
 * Process webhook event based on provider and event type
 */
const processWebhookEvent = async (provider, payload, webhookLog) => {
  const providerHandlers = {
    stripe: processStripeEvent,
    razorpay: processRazorpayEvent,
    paystack: processPaystackEvent,
    flutterwave: processFlutterwaveEvent,
    paypal: processPaypalEvent
  };
  
  const handler = providerHandlers[provider];
  if (!handler) {
    throw new Error(`Unsupported payment provider: ${provider}`);
  }
  
  return await handler(payload, webhookLog);
};

/**
 * Process Stripe webhook events
 */
const processStripeEvent = async (payload, webhookLog) => {
  const eventType = payload.type;
  
  switch (eventType) {
    case 'payment_intent.succeeded':
      return await handlePaymentSuccess(payload.data.object, 'stripe', webhookLog);
    case 'payment_intent.payment_failed':
      return await handlePaymentFailure(payload.data.object, 'stripe', webhookLog);
    case 'payment_intent.canceled':
      return await handlePaymentCancellation(payload.data.object, 'stripe', webhookLog);
    case 'charge.dispute.created':
      return await handlePaymentDispute(payload.data.object, 'stripe', webhookLog);
    default:
      console.log(`Unhandled Stripe event type: ${eventType}`);
      return { paymentId: null };
  }
};

/**
 * Process Razorpay webhook events
 */
const processRazorpayEvent = async (payload, webhookLog) => {
  const eventType = payload.event;
  
  switch (eventType) {
    case 'payment.captured':
      return await handlePaymentSuccess(payload.payload.payment.entity, 'razorpay', webhookLog);
    case 'payment.failed':
      return await handlePaymentFailure(payload.payload.payment.entity, 'razorpay', webhookLog);
    default:
      console.log(`Unhandled Razorpay event type: ${eventType}`);
      return { paymentId: null };
  }
};

/**
 * Process Paystack webhook events
 */
const processPaystackEvent = async (payload, webhookLog) => {
  const eventType = payload.event;
  
  switch (eventType) {
    case 'charge.success':
      return await handlePaymentSuccess(payload.data, 'paystack', webhookLog);
    case 'charge.failed':
      return await handlePaymentFailure(payload.data, 'paystack', webhookLog);
    default:
      console.log(`Unhandled Paystack event type: ${eventType}`);
      return { paymentId: null };
  }
};

/**
 * Process Flutterwave webhook events
 */
const processFlutterwaveEvent = async (payload, webhookLog) => {
  const eventType = payload.event;
  
  switch (eventType) {
    case 'charge.completed':
      return await handlePaymentSuccess(payload.data, 'flutterwave', webhookLog);
    case 'charge.failed':
      return await handlePaymentFailure(payload.data, 'flutterwave', webhookLog);
    default:
      console.log(`Unhandled Flutterwave event type: ${eventType}`);
      return { paymentId: null };
  }
};

/**
 * Process PayPal webhook events
 */
const processPaypalEvent = async (payload, webhookLog) => {
  const eventType = payload.event_type;
  
  switch (eventType) {
    case 'PAYMENT.SALE.COMPLETED':
      return await handlePaymentSuccess(payload.resource, 'paypal', webhookLog);
    case 'PAYMENT.SALE.DENIED':
      return await handlePaymentFailure(payload.resource, 'paypal', webhookLog);
    default:
      console.log(`Unhandled PayPal event type: ${eventType}`);
      return { paymentId: null };
  }
};

/**
 * Handle successful payment
 */
const handlePaymentSuccess = async (paymentData, provider, webhookLog) => {
  return await withTransaction(async (session) => {
    // Find or create payment record
    let payment = await Payment.findByProviderAndId(provider, paymentData.id);
    
    if (!payment) {
      // Create new payment record
      payment = new Payment({
        paymentId: crypto.randomUUID(),
        provider,
        providerPaymentId: paymentData.id,
        amount: extractAmount(paymentData, provider),
        currency: extractCurrency(paymentData, provider),
        status: 'completed',
        userId: extractUserId(paymentData, provider),
        description: extractDescription(paymentData, provider),
        metadata: extractMetadata(paymentData, provider),
        providerData: paymentData,
        completedAt: new Date(),
        idempotencyKey: webhookLog.webhookId
      });
      
      await payment.save({ session });
    } else {
      // Update existing payment
      await payment.updateStatus('completed');
    }
    
    return { paymentId: payment._id };
  });
};

/**
 * Handle failed payment
 */
const handlePaymentFailure = async (paymentData, provider, webhookLog) => {
  return await withTransaction(async (session) => {
    let payment = await Payment.findByProviderAndId(provider, paymentData.id);
    
    if (!payment) {
      // Create new payment record
      payment = new Payment({
        paymentId: crypto.randomUUID(),
        provider,
        providerPaymentId: paymentData.id,
        amount: extractAmount(paymentData, provider),
        currency: extractCurrency(paymentData, provider),
        status: 'failed',
        userId: extractUserId(paymentData, provider),
        description: extractDescription(paymentData, provider),
        metadata: extractMetadata(paymentData, provider),
        providerData: paymentData,
        failureReason: extractFailureReason(paymentData, provider),
        idempotencyKey: webhookLog.webhookId
      });
      
      await payment.save({ session });
    } else {
      // Update existing payment
      await payment.updateStatus('failed', extractFailureReason(paymentData, provider));
    }
    
    return { paymentId: payment._id };
  });
};

/**
 * Handle payment cancellation
 */
const handlePaymentCancellation = async (paymentData, provider, webhookLog) => {
  return await withTransaction(async (session) => {
    let payment = await Payment.findByProviderAndId(provider, paymentData.id);
    
    if (!payment) {
      payment = new Payment({
        paymentId: crypto.randomUUID(),
        provider,
        providerPaymentId: paymentData.id,
        amount: extractAmount(paymentData, provider),
        currency: extractCurrency(paymentData, provider),
        status: 'cancelled',
        userId: extractUserId(paymentData, provider),
        description: extractDescription(paymentData, provider),
        metadata: extractMetadata(paymentData, provider),
        providerData: paymentData,
        idempotencyKey: webhookLog.webhookId
      });
      
      await payment.save({ session });
    } else {
      await payment.updateStatus('cancelled');
    }
    
    return { paymentId: payment._id };
  });
};

/**
 * Handle payment dispute
 */
const handlePaymentDispute = async (disputeData, provider, webhookLog) => {
  // Handle dispute logic here
  console.log(`Payment dispute received for provider: ${provider}`, disputeData);
  return { paymentId: null };
};

/**
 * Extract amount from payment data based on provider
 */
const extractAmount = (paymentData, provider) => {
  switch (provider) {
    case 'stripe':
      return paymentData.amount / 100; // Stripe amounts are in cents
    case 'razorpay':
      return paymentData.amount / 100; // Razorpay amounts are in paise
    case 'paystack':
      return paymentData.amount / 100; // Paystack amounts are in kobo
    case 'flutterwave':
      return paymentData.amount;
    case 'paypal':
      return parseFloat(paymentData.amount.total);
    default:
      return paymentData.amount || 0;
  }
};

/**
 * Extract currency from payment data based on provider
 */
const extractCurrency = (paymentData, provider) => {
  switch (provider) {
    case 'stripe':
      return paymentData.currency?.toUpperCase();
    case 'razorpay':
      return paymentData.currency?.toUpperCase();
    case 'paystack':
      return paymentData.currency?.toUpperCase();
    case 'flutterwave':
      return paymentData.currency?.toUpperCase();
    case 'paypal':
      return paymentData.amount?.currency?.toUpperCase();
    default:
      return paymentData.currency?.toUpperCase() || 'USD';
  }
};

/**
 * Extract user ID from payment data based on provider
 */
const extractUserId = (paymentData, provider) => {
  // This would typically come from metadata or customer information
  // For now, we'll use a placeholder - in production, this should be properly mapped
  return paymentData.metadata?.userId || paymentData.customer || null;
};

/**
 * Extract description from payment data based on provider
 */
const extractDescription = (paymentData, provider) => {
  switch (provider) {
    case 'stripe':
      return paymentData.description;
    case 'razorpay':
      return paymentData.description;
    case 'paystack':
      return paymentData.reference;
    case 'flutterwave':
      return paymentData.narration;
    case 'paypal':
      return paymentData.description;
    default:
      return paymentData.description || 'Payment';
  }
};

/**
 * Extract metadata from payment data based on provider
 */
const extractMetadata = (paymentData, provider) => {
  switch (provider) {
    case 'stripe':
      return paymentData.metadata;
    case 'razorpay':
      return paymentData.notes;
    case 'paystack':
      return paymentData.metadata;
    case 'flutterwave':
      return paymentData.meta;
    case 'paypal':
      return paymentData.custom;
    default:
      return paymentData.metadata || {};
  }
};

/**
 * Extract failure reason from payment data based on provider
 */
const extractFailureReason = (paymentData, provider) => {
  switch (provider) {
    case 'stripe':
      return paymentData.last_payment_error?.message || 'Payment failed';
    case 'razorpay':
      return paymentData.error_description || 'Payment failed';
    case 'paystack':
      return paymentData.gateway_response || 'Payment failed';
    case 'flutterwave':
      return paymentData.processor_response || 'Payment failed';
    case 'paypal':
      return paymentData.reason_code || 'Payment failed';
    default:
      return 'Payment failed';
  }
};

/**
 * Get webhook status for monitoring
 */
export const getWebhookStatus = async (req, res) => {
  try {
    const { webhookId } = req.params;
    
    const webhookLog = await WebhookLog.findOne({ webhookId });
    if (!webhookLog) {
      return ApiResponse.error(res, 'Webhook not found', 404);
    }
    
    return ApiResponse.success(res, {
      webhookId: webhookLog.webhookId,
      status: webhookLog.status,
      provider: webhookLog.provider,
      eventType: webhookLog.eventType,
      receivedAt: webhookLog.receivedAt,
      processingDuration: webhookLog.processingDuration,
      errorMessage: webhookLog.errorMessage
    });
  } catch (error) {
    console.error('Get webhook status error:', error);
    return ApiResponse.error(res, 'Failed to get webhook status', 500);
  }
};
