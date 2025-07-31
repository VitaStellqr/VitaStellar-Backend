import express from 'express';
import authController from '../controllers/authController.js';
import protect from '../middleware/authMiddleware.js';

const router = express.Router();

// Basic authentication
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/login-2fa', authController.loginWith2FA);

// 2FA Management (Protected routes)
router.use(protect); // Apply authentication middleware to all routes below

// SMS 2FA
router.post('/2fa/sms/enable', authController.enableSMS2FA);
router.post('/2fa/sms/verify', authController.verifySMS2FA);

// TOTP 2FA
router.post('/2fa/totp/enable', authController.enableTOTP2FA);
router.post('/2fa/totp/verify', authController.verifyTOTP2FA);

// 2FA Status and Management
router.get('/2fa/status', authController.get2FAStatus);
router.post('/2fa/disable', authController.disable2FA);

// Trusted Device Management
router.delete('/2fa/devices/:deviceId', authController.revokeTrustedDevice);

export default router;
