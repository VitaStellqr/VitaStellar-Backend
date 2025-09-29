/* eslint-disable prettier/prettier */
import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  // Payment identification
  paymentId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // External provider information
  provider: {
    type: String,
    required: true,
    enum: ['stripe', 'paypal', 'razorpay', 'flutterwave', 'paystack'],
    index: true
  },
  
  providerPaymentId: {
    type: String,
    required: true,
    index: true
  },
  
  // Payment details
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  
  currency: {
    type: String,
    required: true,
    default: 'USD',
    uppercase: true
  },
  
  // Status tracking
  status: {
    type: String,
    required: true,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'],
    default: 'pending',
    index: true
  },
  
  // User association
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Payment metadata
  description: {
    type: String,
    maxlength: 500
  },
  
  metadata: {
    type: Map,
    of: String
  },
  
  // Provider-specific data
  providerData: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  // Payment completion
  completedAt: {
    type: Date,
    index: true
  },
  
  // Failure information
  failureReason: {
    type: String,
    maxlength: 1000
  },
  
  // Idempotency
  idempotencyKey: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
paymentSchema.index({ userId: 1, status: 1 });
paymentSchema.index({ provider: 1, providerPaymentId: 1 });
paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ completedAt: -1 });

// Virtual for payment age
paymentSchema.virtual('ageInDays').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Pre-save middleware to update timestamps
paymentSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }
  
  // Set completedAt when status changes to completed
  if (this.isModified('status') && this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }
  
  next();
});

// Static method to find by idempotency key
paymentSchema.statics.findByProviderAndId = function(provider, providerPaymentId) {
  return this.findOne({ provider, providerPaymentId });
};

// Static method to find by idempotency key
paymentSchema.statics.findByIdempotencyKey = function(idempotencyKey) {
  return this.findOne({ idempotencyKey });
};

// Instance method to update status safely
paymentSchema.methods.updateStatus = function(newStatus, failureReason = null) {
  const allowedTransitions = {
    'pending': ['processing', 'completed', 'failed', 'cancelled'],
    'processing': ['completed', 'failed', 'cancelled'],
    'completed': ['refunded'],
    'failed': ['pending'], // Allow retry
    'cancelled': ['pending'], // Allow retry
    'refunded': [] // Terminal state
  };
  
  if (!allowedTransitions[this.status]?.includes(newStatus)) {
    throw new Error(`Invalid status transition from ${this.status} to ${newStatus}`);
  }
  
  this.status = newStatus;
  if (failureReason) {
    this.failureReason = failureReason;
  }
  
  return this.save();
};

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment;
