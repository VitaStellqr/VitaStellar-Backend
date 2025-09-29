/* eslint-disable prettier/prettier */
import mongoose from 'mongoose';

const webhookLogSchema = new mongoose.Schema({
  // Webhook identification
  webhookId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Provider information
  provider: {
    type: String,
    required: true,
    enum: ['stripe', 'paypal', 'razorpay', 'flutterwave', 'paystack'],
    index: true
  },
  
  // Event details
  eventType: {
    type: String,
    required: true,
    index: true
  },
  
  eventId: {
    type: String,
    required: true,
    index: true
  },
  
  // Request information
  requestId: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  
  // Signature validation
  signature: {
    type: String,
    required: true
  },
  
  signatureValid: {
    type: Boolean,
    required: true,
    default: false,
    index: true
  },
  
  // Processing status
  status: {
    type: String,
    required: true,
    enum: ['received', 'processing', 'processed', 'failed', 'duplicate'],
    default: 'received',
    index: true
  },
  
  // Raw payload
  rawPayload: {
    type: String,
    required: true
  },
  
  // Parsed payload
  parsedPayload: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  
  // Request metadata
  ipAddress: {
    type: String,
    required: true,
    index: true
  },
  
  userAgent: {
    type: String
  },
  
  // Processing information
  processingStartedAt: {
    type: Date,
    index: true
  },
  
  processingCompletedAt: {
    type: Date,
    index: true
  },
  
  processingDuration: {
    type: Number, // in milliseconds
    index: true
  },
  
  // Error information
  errorMessage: {
    type: String,
    maxlength: 2000
  },
  
  errorStack: {
    type: String
  },
  
  // Retry information
  retryCount: {
    type: Number,
    default: 0,
    index: true
  },
  
  maxRetries: {
    type: Number,
    default: 3
  },
  
  nextRetryAt: {
    type: Date,
    index: true
  },
  
  // Related entities
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    index: true
  },
  
  // Timestamps
  receivedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  // Retention
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
webhookLogSchema.index({ provider: 1, eventId: 1 });
webhookLogSchema.index({ provider: 1, eventType: 1, receivedAt: -1 });
webhookLogSchema.index({ status: 1, nextRetryAt: 1 });
webhookLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for processing duration
webhookLogSchema.virtual('isExpired').get(function() {
  return this.expiresAt && this.expiresAt < new Date();
});

// Virtual for retry eligibility
webhookLogSchema.virtual('canRetry').get(function() {
  return this.retryCount < this.maxRetries && 
         this.status === 'failed' && 
         (!this.nextRetryAt || this.nextRetryAt <= new Date());
});

// Pre-save middleware
webhookLogSchema.pre('save', function(next) {
  // Calculate processing duration
  if (this.processingStartedAt && this.processingCompletedAt) {
    this.processingDuration = this.processingCompletedAt - this.processingStartedAt;
  }
  
  next();
});

// Static method to find by provider and event ID
webhookLogSchema.statics.findByProviderAndEventId = function(provider, eventId) {
  return this.findOne({ provider, eventId });
};

// Static method to find by request ID
webhookLogSchema.statics.findByRequestId = function(requestId) {
  return this.findOne({ requestId });
};

// Static method to find retryable webhooks
webhookLogSchema.statics.findRetryable = function() {
  return this.find({
    status: 'failed',
    retryCount: { $lt: '$maxRetries' },
    $or: [
      { nextRetryAt: { $lte: new Date() } },
      { nextRetryAt: { $exists: false } }
    ]
  });
};

// Instance method to mark as processing
webhookLogSchema.methods.markAsProcessing = function() {
  this.status = 'processing';
  this.processingStartedAt = new Date();
  return this.save();
};

// Instance method to mark as processed
webhookLogSchema.methods.markAsProcessed = function(paymentId = null) {
  this.status = 'processed';
  this.processingCompletedAt = new Date();
  if (paymentId) {
    this.paymentId = paymentId;
  }
  return this.save();
};

// Instance method to mark as failed
webhookLogSchema.methods.markAsFailed = function(errorMessage, errorStack = null) {
  this.status = 'failed';
  this.processingCompletedAt = new Date();
  this.errorMessage = errorMessage;
  if (errorStack) {
    this.errorStack = errorStack;
  }
  
  // Calculate next retry time with exponential backoff
  if (this.retryCount < this.maxRetries) {
    this.retryCount += 1;
    const backoffMs = Math.pow(2, this.retryCount) * 1000; // Exponential backoff
    this.nextRetryAt = new Date(Date.now() + backoffMs);
  }
  
  return this.save();
};

// Instance method to mark as duplicate
webhookLogSchema.methods.markAsDuplicate = function() {
  this.status = 'duplicate';
  this.processingCompletedAt = new Date();
  return this.save();
};

const WebhookLog = mongoose.model('WebhookLog', webhookLogSchema);

export default WebhookLog;
