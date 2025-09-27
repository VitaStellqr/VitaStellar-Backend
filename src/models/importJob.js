/* eslint-disable prettier/prettier */
import mongoose from 'mongoose';

const importJobSchema = new mongoose.Schema(
  {
    filePath: { type: String, required: true }, // or S3/GridFS reference
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
      default: 'pending',
    },
    totalRows: Number,
    successCount: { type: Number, default: 0 },
    errorCount: { type: Number, default: 0 },
    errorReportPath: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export default mongoose.model('ImportJob', importJobSchema);
