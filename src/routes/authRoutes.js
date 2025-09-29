import express from 'express';
import authController from '../controllers/authController.js';
import protect from '../middleware/authMiddleware.js';
import {
  authRateLimit,
  twoFactorRateLimit,
  passwordResetRateLimit,
} from '../middleware/rateLimiter.js';

const router = express.Router();

// Basic authentication with strict rate limiting
router.post('/register', authRateLimit, authController.register);
router.post('/login', authRateLimit, authController.login);
router.post('/login-2fa', twoFactorRateLimit, authController.loginWith2FA);
router.post('/forgot-password', passwordResetRateLimit, authController.forgotPassword);
router.post('/reset-password/:token', passwordResetRateLimit, authController.resetPassword);

// 2FA Management (Protected routes)
router.use(protect); // Apply authentication middleware to all routes below

// SMS 2FA with rate limiting
router.post('/2fa/sms/enable', twoFactorRateLimit, authController.enableSMS2FA);
router.post('/2fa/sms/verify', twoFactorRateLimit, authController.verifySMS2FA);

// TOTP 2FA with rate limiting
router.post('/2fa/totp/enable', twoFactorRateLimit, authController.enableTOTP2FA);
router.post('/2fa/totp/verify', twoFactorRateLimit, authController.verifyTOTP2FA);

// 2FA Status and Management
router.get('/2fa/status', authController.get2FAStatus);
router.post('/2fa/disable', twoFactorRateLimit, authController.disable2FA);

// Trusted Device Management
router.delete('/2fa/devices/:deviceId', authController.revokeTrustedDevice);

export default router;
