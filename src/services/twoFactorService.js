import crypto from 'crypto';
import nodemailer from 'nodemailer';
import User from '../models/User.js';

class TwoFactorService {
  // Generate TOTP secret
  static generateTOTPSecret() {
    return crypto.randomBytes(20).toString('base32');
  }

  // Generate TOTP code using time-based algorithm
  static generateTOTP(secret, window = 0) {
    const timeStep = 30; // 30 seconds
    const currentTime = Math.floor(Date.now() / 1000);
    const timeWindow = Math.floor(currentTime / timeStep) + window;
    
    const hmac = crypto.createHmac('sha1', Buffer.from(secret, 'base32'));
    hmac.update(Buffer.from(timeWindow.toString(16).padStart(16, '0'), 'hex'));
    const hash = hmac.digest();
    
    const offset = hash[hash.length - 1] & 0xf;
    const code = ((hash[offset] & 0x7f) << 24) |
                 ((hash[offset + 1] & 0xff) << 16) |
                 ((hash[offset + 2] & 0xff) << 8) |
                 (hash[offset + 3] & 0xff);
    
    return (code % 1000000).toString().padStart(6, '0');
  }

  // Verify TOTP code with time window tolerance
  static verifyTOTP(secret, code) {
    // Check current window and adjacent windows for clock skew tolerance
    for (let window = -1; window <= 1; window++) {
      const expectedCode = this.generateTOTP(secret, window);
      if (expectedCode === code) {
        return true;
      }
    }
    return false;
  }

  // Generate backup codes
  static generateBackupCodes(count = 10) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      codes.push({
        code: crypto.randomBytes(4).toString('hex').toUpperCase().match(/.{1,4}/g).join('-'),
        used: false
      });
    }
    return codes;
  }

  // Generate QR code URI for authenticator apps
  static generateQRCodeURI(email, secret, issuer = 'Uzima-Backend') {
    return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
  }

  // Send TOTP setup email with QR code
  static async sendTOTPSetupEmail(email, secret) {
    try {
      const qrUri = this.generateQRCodeURI(email, secret);
      const transporter = nodemailer.createTransporter({
        // Configure based on your email service
        sendmail: true
      });

      await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@uzima.app',
        to: email,
        subject: 'Set Up Two-Factor Authentication',
        html: `
          <h2>Set Up Two-Factor Authentication</h2>
          <p>Please scan the QR code below with your authenticator app:</p>
          <p><strong>Manual Entry Key:</strong> ${secret}</p>
          <p><strong>QR Code URI:</strong> ${qrUri}</p>
          <p>Alternatively, you can manually enter the key above in your authenticator app.</p>
          <p>If you didn't request this, please ignore this email.</p>
        `
      });
    } catch (error) {
      console.error('Failed to send TOTP setup email:', error);
      throw new Error('Failed to send setup email');
    }
  }

  // Generate SMS verification code
  static generateSMSCode() {
    return crypto.randomInt(100000, 999999).toString();
  }

  // Generate trusted device token
  static generateDeviceToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Check if device is trusted
  static async isDeviceTrusted(userId, deviceId) {
    const user = await User.findById(userId);
    if (!user) return false;

    const device = user.twoFactorAuth.trustedDevices.find(d => 
      d.deviceId === deviceId && 
      !d.revoked && 
      d.expiresAt > new Date()
    );
    
    return !!device;
  }

  // Add trusted device
  static async addTrustedDevice(userId, deviceInfo, ipAddress, userAgent) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    const deviceId = this.generateDeviceToken();
    
    user.twoFactorAuth.trustedDevices.push({
      deviceId,
      deviceInfo,
      ipAddress,
      userAgent,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    });

    await user.save();
    return deviceId;
  }

  // Revoke trusted device
  static async revokeTrustedDevice(userId, deviceId) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    const device = user.twoFactorAuth.trustedDevices.find(d => d.deviceId === deviceId);
    if (device) {
      device.revoked = true;
    }

    await user.save();
  }

  // Clean expired devices
  static async cleanExpiredDevices(userId) {
    const user = await User.findById(userId);
    if (!user) return;

    user.twoFactorAuth.trustedDevices = user.twoFactorAuth.trustedDevices.filter(
      device => device.expiresAt > new Date() && !device.revoked
    );

    await user.save();
  }
}

export default TwoFactorService;
