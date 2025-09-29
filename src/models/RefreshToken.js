/* eslint-disable prettier/prettier */
import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema(
	{
		userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
		tokenHash: { type: String, required: true, index: true, unique: true },
		expiresAt: { type: Date, required: true, index: true },
		revokedAt: { type: Date, default: null, index: true },
		replacedByTokenHash: { type: String, default: null },
		createdByIp: { type: String, default: null },
		revokedByIp: { type: String, default: null },
		userAgent: { type: String, default: null },
	},
	{ timestamps: true }
);

refreshTokenSchema.methods.isActive = function () {
	return !this.revokedAt && this.expiresAt > new Date();
};

export default mongoose.model('RefreshToken', refreshTokenSchema);


