# Payment Webhook Handler Implementation

This document describes the secure payment webhook handler implementation for the Uzima Backend API.

## Overview

The payment webhook handler provides secure, idempotent processing of payment provider webhooks with HMAC signature validation and comprehensive logging.

## Features

- **Multi-Provider Support**: Stripe, PayPal, Razorpay, Paystack, Flutterwave
- **HMAC Signature Validation**: Provider-specific signature verification
- **Idempotent Processing**: Duplicate webhook prevention
- **Comprehensive Logging**: Full webhook event tracking
- **Error Handling**: Graceful failure handling with retry logic
- **Rate Limiting**: Webhook-specific rate limiting
- **Transaction Safety**: Database transactions for data consistency

## Architecture

### Models

#### Payment Model (`src/models/Payment.js`)
- Tracks payment status and metadata
- Supports multiple payment providers
- Idempotency key support
- Status transition validation

#### WebhookLog Model (`src/models/WebhookLog.js`)
- Logs all webhook events
- Prevents duplicate processing
- Retry logic with exponential backoff
- Automatic cleanup after 90 days

### Middleware

#### Webhook Validation (`src/middleware/webhookValidation.js`)
- HMAC signature validation for all providers
- Provider-specific signature formats
- Raw body capture for signature verification
- Rate limiting for webhook endpoints

### Controllers

#### Webhook Controller (`src/controllers/webhookController.js`)
- Main webhook processing logic
- Provider-specific event handling
- Idempotent payment updates
- Error handling and logging

## API Endpoints

### POST /payments/webhook
Handles payment webhooks from all providers.

**Headers:**
- `stripe-signature`: Stripe webhook signature
- `x-razorpay-signature`: Razorpay webhook signature
- `x-paystack-signature`: Paystack webhook signature
- `x-flutterwave-signature`: Flutterwave webhook signature
- `x-webhook-signature`: Generic webhook signature

### POST /payments/webhook/:provider
Handles provider-specific webhooks.

**Supported Providers:**
- `stripe`
- `paypal`
- `razorpay`
- `flutterwave`
- `paystack`

### GET /payments/webhook/status/:webhookId
Retrieves webhook processing status.

## Environment Variables

Add the following webhook secrets to your `.env` file:

```env
# Stripe
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret

# Razorpay
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret

# Paystack
PAYSTACK_WEBHOOK_SECRET=your_paystack_webhook_secret

# Flutterwave
FLUTTERWAVE_WEBHOOK_SECRET=your_flutterwave_webhook_secret

# PayPal
PAYPAL_WEBHOOK_SECRET=your_paypal_webhook_secret
```

## Security Features

### HMAC Signature Validation
- Provider-specific signature formats
- Timestamp validation (prevents replay attacks)
- Timing-safe comparison
- Signature verification before processing

### Idempotency
- Duplicate webhook detection
- Idempotency key support
- Safe status transitions
- Database transaction safety

### Rate Limiting
- Webhook-specific rate limiting
- Provider-controlled limits
- Abuse prevention

## Supported Webhook Events

### Stripe
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `payment_intent.canceled`
- `charge.dispute.created`

### Razorpay
- `payment.captured`
- `payment.failed`

### Paystack
- `charge.success`
- `charge.failed`

### Flutterwave
- `charge.completed`
- `charge.failed`

### PayPal
- `PAYMENT.SALE.COMPLETED`
- `PAYMENT.SALE.DENIED`

## Error Handling

### Webhook Processing Errors
- Invalid signatures return 401
- Missing signatures return 401
- Processing errors return 500
- All errors are logged with stack traces

### Retry Logic
- Exponential backoff for failed webhooks
- Configurable retry limits
- Automatic retry scheduling
- Dead letter queue for permanent failures

## Monitoring and Logging

### Webhook Logs
- Complete webhook event history
- Processing duration tracking
- Error message logging
- IP address and user agent tracking

### Payment Tracking
- Payment status updates
- Provider-specific metadata
- User association
- Transaction history

## Testing

Run the webhook tests:

```bash
npm test -- --testPathPattern=webhook.test.js
```

### Test Coverage
- Webhook signature validation
- Idempotent processing
- Payment status updates
- Error handling
- Duplicate prevention
- Provider-specific processing

## Performance Considerations

### Database Indexes
- Optimized for webhook lookups
- Payment status queries
- User-based filtering
- Time-based queries

### Caching
- Webhook signature validation caching
- Payment status caching
- Provider configuration caching

### Scalability
- Horizontal scaling support
- Database connection pooling
- Async processing
- Queue-based processing

## Deployment

### Production Checklist
- [ ] Set all webhook secrets in environment variables
- [ ] Configure database indexes
- [ ] Set up monitoring and alerting
- [ ] Configure rate limiting
- [ ] Test webhook endpoints
- [ ] Set up log aggregation
- [ ] Configure backup and recovery

### Monitoring
- Webhook processing metrics
- Error rate monitoring
- Performance tracking
- Security monitoring

## Troubleshooting

### Common Issues

#### Invalid Signature Errors
- Verify webhook secrets are correct
- Check signature format for provider
- Ensure raw body is captured correctly

#### Duplicate Webhook Processing
- Check idempotency key implementation
- Verify event ID uniqueness
- Review webhook log entries

#### Payment Status Not Updating
- Check payment model validation
- Verify status transition rules
- Review error logs

### Debug Mode
Enable debug logging by setting:
```env
NODE_ENV=development
DEBUG=webhook:*
```

## Security Best Practices

1. **Always validate webhook signatures**
2. **Use HTTPS for webhook endpoints**
3. **Implement rate limiting**
4. **Log all webhook events**
5. **Monitor for suspicious activity**
6. **Regular security audits**
7. **Keep webhook secrets secure**
8. **Use environment variables for secrets**

## Future Enhancements

- [ ] Webhook event filtering
- [ ] Custom webhook processors
- [ ] Webhook analytics dashboard
- [ ] Real-time webhook monitoring
- [ ] Webhook replay functionality
- [ ] Multi-tenant webhook support
