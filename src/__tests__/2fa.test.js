import request from 'supertest';
import app from '../app'; // Assuming the Express app is exported from app.js
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import * as smsUtils from '../utils/smsUtils';
import * as twoFactorService from '../services/twoFactorService';

describe('Two-Factor Authentication', () = {
  let server;
  beforeAll(async () = {
    server = app.listen(4000); // Start the server on test port
  });

  afterAll(async () = {
    await server.close();
    await mongoose.connection.close();
  });

  let userMock, jwtToken;

  beforeEach(async () = {
    // Set up user
    const user = new User({
      username: 'testuser',
      email: 'testuser@example.com',
      password: 'Password123!',
      role: 'patient',
      twoFactorAuth: {
        isEnabled: false,
        methods: {
          sms: { enabled: false },
          totp: { enabled: false }
        },
        trustedDevices: []
      }
    });
    await user.save();

    userMock = user;
    jwtToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  });

  afterEach(async () = {
    await User.deleteMany();
  });

  test('should register device for SMS 2FA', async () = {
    jest.spyOn(smsUtils, 'sendSMS').mockResolvedValue({ success: true });
    const res = await request(server)
      .post('/api/2fa/sms/enable')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({ phoneNumber: '+1234567890' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('SMS 2FA setup initiated');
  });

  test('should verify SMS 2FA code successfully', async () = {
    // Mocking SMS sending and verification code
    jest.spyOn(smsUtils, 'sendSMS').mockResolvedValue({ success: true });
    await userMock.updateOne({
      'twoFactorAuth.methods.sms.phoneNumber': '+1234567890',
      'twoFactorAuth.methods.sms.verificationCode': '123456',
      'twoFactorAuth.methods.sms.verificationExpiry': new Date(Date.now() + 10 * 60 * 1000)
    });
    
    const resEnable = await request(server)
      .post('/api/2fa/sms/enable')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({ phoneNumber: '+1234567890' });

    expect(resEnable.statusCode).toBe(200);

    const resVerify = await request(server)
      .post('/api/2fa/sms/verify')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({ code: '123456' });

    expect(resVerify.statusCode).toBe(200);
    expect(resVerify.body.success).toBe(true);
    expect(resVerify.body.message).toBe('SMS 2FA enabled successfully');
  });

  test('should enroll in TOTP 2FA', async () = {
    jest.spyOn(twoFactorService, 'sendTOTPSetupEmail').mockResolvedValue();

    const res = await request(server)
      .post('/api/2fa/totp/enable')
      .set('Authorization', `Bearer ${jwtToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('TOTP 2FA setup initiated');
    expect(res.body.data.qrCodeURI).toBeDefined();
    expect(res.body.data.secret).toBeDefined();
  });

  test('should verify TOTP 2FA code successfully', async () = {
    //secret
    const secret = twoFactorService.generateTOTPSecret();
    const code = twoFactorService.generateTOTP(secret);

    //function
    await userMock.updateOne({
      'twoFactorAuth.methods.totp.secret': secret,
      'twoFactorAuth.methods.totp.backupCodes': twoFactorService.generateBackupCodes()
    });

    const resEnable = await request(server)
      .post('/api/2fa/totp/enable')
      .set('Authorization', `Bearer ${jwtToken}`);

    expect(resEnable.statusCode).toBe(200);

    const resVerify = await request(server)
      .post('/api/2fa/totp/verify')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({ code });

    expect(resVerify.statusCode).toBe(200);
    expect(resVerify.body.success).toBe(true);
    expect(resVerify.body.message).toBe('TOTP 2FA enabled successfully');
  });

  //test
  test('should login with 2FA successfully', async () = {
    const secret = twoFactorService.generateTOTPSecret();
    const code = twoFactorService.generateTOTP(secret);

    await userMock.updateOne({
      'twoFactorAuth.isEnabled': true,
      'twoFactorAuth.methods.totp.secret': secret,
      'twoFactorAuth.methods.totp.enabled': true
    });

    const res = await request(server)
      .post('/api/login-2fa')
      .send({
        email: 'testuser@example.com',
        password: 'Password123!',
        twoFactorCode: code,
        method: 'totp'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Login successful');
    expect(res.body.data.token).toBeDefined();
  });
});
