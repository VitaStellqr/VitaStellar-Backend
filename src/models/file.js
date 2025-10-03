const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    key: {
      type: String,
      required: true,
      unique: true,
    },
    filename: {
      type: String,
      required: true,
    },
    contentType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'scanning', 'clean', 'infected', 'quarantined'],
      default: 'pending',
      index: true,
    },
    scanResult: {
      scannedAt: Date,
      scanner: String,
      threats: [String],
      details: mongoose.Schema.Types.Mixed,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    lastAccessedAt: Date,
    metadata: mongoose.Schema.Types.Mixed,
  },
  {
    timestamps: true,
  }
);

// Index for querying user files
fileSchema.index({ userId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('File', fileSchema);
