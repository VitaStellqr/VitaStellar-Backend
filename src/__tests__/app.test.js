/* eslint-disable prettier/prettier */
import request from 'supertest';
import mongoose from 'mongoose';
import app from './app';
import User from './models/User';
import ROLES from './roles';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

beforeAll(async () => {
  await mongoose.connect('mongodb://localhost:27017/healthcareRBAC_test');
  await User.deleteMany({});
});

afterAll(async () => {
  await mongoose.connection.close();
});

function makeToken(user) {
  return jwt.sign({ id: user._id, roles: user.roles }, process.env.JWT_SECRET || 'secret');
}

test('blocks patient from accessing admin route', async () => {
  const patient = new User({
    email: 'p@test.com',
    passwordHash: await bcrypt.hash('pass', 10),
    roles: [ROLES.PATIENT],
  });
  await patient.save();

  const token = makeToken(patient);

  const res = await request(app).get('/admin/panel').set('Authorization', `Bearer ${token}`);

  expect(res.statusCode).toBe(403);
});

test('allows admin to access admin route', async () => {
  const admin = new User({
    email: 'a@test.com',
    passwordHash: await bcrypt.hash('pass', 10),
    roles: [ROLES.ADMIN],
  });
  await admin.save();

  const token = makeToken(admin);

  const res = await request(app).get('/admin/panel').set('Authorization', `Bearer ${token}`);

  expect(res.statusCode).toBe(200);
  expect(res.body.message).toBe('Admin control panel');
});
