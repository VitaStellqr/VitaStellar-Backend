/* eslint-disable prettier/prettier */
import crypto from 'crypto';
import ApiResponse from '../utils/ApiResponse.js';

/**
 * HMAC signature validation middleware for webhook security
 * Supports multiple payment providers with their specific signature formats
 */
const validateWebhookSignature = (provider) => {
  return (req, res, next) => {
    try {
      const signature = req.headers['x-webhook-signature'] || 
                       req.headers['stripe-signature'] || 
                       req.headers['x-razorpay-signature'] ||
                       req.headers['x-paystack-signature'] ||
                       req.headers['x-flutterwave-signature'];

      if (!signature) {
        return ApiResponse.error(res, 'Missing webhook signature', 401);
      }

      const webhookSecret = getWebhookSecret(provider);
      if (!webhookSecret) {
        return ApiResponse.error(res, 'Webhook secret not configured', 500);
      }

      const rawBody = req.rawBody || JSON.stringify(req.body);
      const isValid = validateSignature(provider, signature, rawBody, webhookSecret);

      if (!isValid) {
        return ApiResponse.error(res, 'Invalid webhook signature', 401);
      }

      // Store validation info for logging
      req.webhookValidation = {
        provider,
        signature,
        validated: true,
        timestamp: new Date()
      };

      next();
    } catch (error) {
      console.error('Webhook signature validation error:', error);
      return ApiResponse.error(res, 'Webhook validation failed', 500);
    }
  };
};

/**
 * Get webhook secret for the specified provider
 */
const getWebhookSecret = (provider) => {
  const secrets = {
    stripe: process.env.STRIPE_WEBHOOK_SECRET,
    paypal: process.env.PAYPAL_WEBHOOK_SECRET,
    razorpay: process.env.RAZORPAY_WEBHOOK_SECRET,
    flutterwave: process.env.FLUTTERWAVE_WEBHOOK_SECRET,
    paystack: process.env.PAYSTACK_WEBHOOK_SECRET
  };

  return secrets[provider];
};

/**
 * Validate signature based on provider-specific format
 */
const validateSignature = (provider, signature, payload, secret) => {
  switch (provider) {
    case 'stripe':
      return validateStripeSignature(signature, payload, secret);
    case 'razorpay':
      return validateRazorpaySignature(signature, payload, secret);
    case 'paystack':
      return validatePaystackSignature(signature, payload, secret);
    case 'flutterwave':
      return validateFlutterwaveSignature(signature, payload, secret);
    case 'paypal':
      return validatePaypalSignature(signature, payload, secret);
    default:
      return validateGenericHMAC(signature, payload, secret);
  }
};

/**
 * Stripe signature validation
 * Format: t=timestamp,v1=signature
 */
const validateStripeSignature = (signature, payload, secret) => {
  try {
    const elements = signature.split(',');
    const timestamp = elements.find(el => el.startsWith('t='))?.split('=')[1];
    const signatureHash = elements.find(el => el.startsWith('v1='))?.split('=')[1];

    if (!timestamp || !signatureHash) {
      return false;
    }

    // Check timestamp (prevent replay attacks)
    const timestampInt = parseInt(timestamp, 10);
    const timestampAge = Date.now() / 1000 - timestampInt;
    if (timestampAge > 300) { // 5 minutes
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(timestamp + '.' + payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signatureHash, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('Stripe signature validation error:', error);
    return false;
  }
};

/**
 * Razorpay signature validation
 * Format: HMAC-SHA256
 */
const validateRazorpaySignature = (signature, payload, secret) => {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('Razorpay signature validation error:', error);
    return false;
  }
};

/**
 * Paystack signature validation
 * Format: HMAC-SHA512
 */
const validatePaystackSignature = (signature, payload, secret) => {
  try {
    const expectedSignature = crypto
      .createHmac('sha512', secret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('Paystack signature validation error:', error);
    return false;
  }
};

/**
 * Flutterwave signature validation
 * Format: HMAC-SHA256
 */
const validateFlutterwaveSignature = (signature, payload, secret) => {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('Flutterwave signature validation error:', error);
    return false;
  }
};

/**
 * PayPal signature validation
 * Format: HMAC-SHA256
 */
const validatePaypalSignature = (signature, payload, secret) => {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('PayPal signature validation error:', error);
    return false;
  }
};

/**
 * Generic HMAC validation (fallback)
 */
const validateGenericHMAC = (signature, payload, secret) => {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('Generic HMAC validation error:', error);
    return false;
  }
};

/**
 * Middleware to capture raw body for signature validation
 * Must be used before body parsing middleware
 */
const captureRawBody = (req, res, next) => {
  let data = '';
  
  req.setEncoding('utf8');
  
  req.on('data', (chunk) => {
    data += chunk;
  });
  
  req.on('end', () => {
    req.rawBody = data;
    next();
  });
  
  req.on('error', (error) => {
    console.error('Raw body capture error:', error);
    return ApiResponse.error(res, 'Request body capture failed', 500);
  });
};

/**
 * Rate limiting specifically for webhook endpoints
 * More lenient than regular API rate limiting
 */
const webhookRateLimit = (req, res, next) => {
  // Webhook rate limiting is handled by the provider
  // We just need to ensure we don't get overwhelmed
  // This is a basic implementation - in production, use Redis-based rate limiting
  next();
};

export {
  validateWebhookSignature,
  captureRawBody,
  webhookRateLimit
};
