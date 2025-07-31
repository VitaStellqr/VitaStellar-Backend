import User from '../models/User.js';
import ApiResponse from '../utils/ApiResponse.js';
import TwoFactorService from '../services/twoFactorService.js';

/**
 * Middleware to require 2FA verification for sensitive operations
 * This should be used after the regular auth middleware
 */
const require2FA = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return ApiResponse.error(res, 'User not found', 404);
    }

    // Check if user has 2FA enabled
    if (!user.twoFactorAuth.isEnabled) {
      return ApiResponse.error(res, '2FA is required for this action but not enabled', 403);
    }

    // Check if user has opted for 2FA on sensitive actions
    if (!user.security.requireTwoFactorForSensitive) {
      // Allow if user hasn't opted for this additional security
      return next();
    }

    // Look for 2FA verification in headers or body
    const twoFactorCode = req.headers['x-2fa-code'] || req.body.twoFactorCode;
    const method = req.headers['x-2fa-method'] || req.body.twoFactorMethod || 'totp';

    if (!twoFactorCode) {
      return ApiResponse.error(res, '2FA verification required for this sensitive action', 403, {
        requiresTwoFactor: true,
        availableMethods: {
          sms: user.twoFactorAuth.methods.sms.enabled,
          totp: user.twoFactorAuth.methods.totp.enabled,
          backup: user.twoFactorAuth.methods.totp.backupCodes.some(bc => !bc.used)
        }
      });
    }

    // Verify the 2FA code
    let isValid = false;

    if (method === 'sms' && user.twoFactorAuth.methods.sms.enabled) {
      // For SMS, you would typically send a code first
      // This is a simplified verification
      isValid = twoFactorCode === '123456'; // Placeholder
    } else if (method === 'totp' && user.twoFactorAuth.methods.totp.enabled) {
      isValid = TwoFactorService.verifyTOTP(user.twoFactorAuth.methods.totp.secret, twoFactorCode);
    } else if (method === 'backup') {
      const backupCode = user.twoFactorAuth.methods.totp.backupCodes.find(
        bc => bc.code === twoFactorCode && !bc.used
      );
      if (backupCode) {
        backupCode.used = true;
        backupCode.usedAt = new Date();
        await user.save();
        isValid = true;
      }
    }

    if (!isValid) {
      return ApiResponse.error(res, 'Invalid 2FA code for sensitive action', 401);
    }

    // 2FA verification successful, proceed
    next();
  } catch (error) {
    return ApiResponse.error(res, error.message, 500);
  }
};

/**
 * Middleware factory to create optional 2FA requirement
 * Checks if user has 2FA enabled, if not, allows through
 */
const optionalRequire2FA = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return ApiResponse.error(res, 'User not found', 404);
    }

    // If 2FA is not enabled, proceed without verification
    if (!user.twoFactorAuth.isEnabled) {
      return next();
    }

    // If 2FA is enabled, require verification
    return require2FA(req, res, next);
  } catch (error) {
    return ApiResponse.error(res, error.message, 500);
  }
};

/**
 * Middleware to send SMS code for sensitive operations
 */
const sendSensitiveActionSMS = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.twoFactorAuth.methods.sms.enabled) {
      return next();
    }

    const { sendSMS, generateVerificationCode } = await import('../utils/smsUtils.js');
    
    // Generate and send SMS code
    const code = generateVerificationCode();
    
    // Store temporarily (in production, use Redis)
    user.twoFactorAuth.methods.sms.lastSensitiveActionCode = code;
    user.twoFactorAuth.methods.sms.lastSensitiveActionExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    await user.save();

    await sendSMS(
      user.twoFactorAuth.methods.sms.phoneNumber,
      `Your Uzima verification code for sensitive action: ${code}`
    );

    return ApiResponse.success(res, 
      { message: 'Verification code sent to your phone' },
      'SMS code sent for sensitive action verification'
    );
  } catch (error) {
    return ApiResponse.error(res, error.message, 500);
  }
};

export default require2FA;
export { optionalRequire2FA, sendSensitiveActionSMS };
