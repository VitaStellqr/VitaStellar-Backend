/* eslint-disable prettier/prettier */
import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from './models/User.js';
import ROLES from './roles.js';
import auth from './middleware/auth.js';
import requireRoles from './middleware/requireRoles.js';

const app = express();
app.use(express.json());

// Register user
app.post('/register', async (req, res) => {
  const { email, password, roles } = req.body;
  const passwordHash = await bcrypt.hash(password, 10);
  const user = new User({ email, passwordHash, roles });
  await user.save();
  res.json({ message: 'User registered', user });
});

// Login user -> returns JWT
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ message: 'Invalid email' });

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) return res.status(400).json({ message: 'Invalid password' });

  const token = jwt.sign(
    { id: user._id, email: user.email, roles: user.roles },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '1h' }
  );

  res.json({ token });
});

// Patient route
app.get('/patient/dashboard', auth, requireRoles(ROLES.PATIENT), (req, res) => {
  res.json({ message: 'Patient dashboard' });
});

// Doctor route
app.get('/doctor/records', auth, requireRoles(ROLES.DOCTOR), (req, res) => {
  res.json({ message: 'Doctor records' });
});

// Admin route
app.get('/admin/panel', auth, requireRoles(ROLES.ADMIN), (req, res) => {
  res.json({ message: 'Admin control panel' });
});

// Connect to Mongo and start server
mongoose
  .connect('mongodb://localhost:27017/healthcareRBAC')
  .then(() => {
    app.listen(3000, () => {
      // eslint-disable-next-line no-console
      console.log('Server running on port 3000');
    });
  })
  // eslint-disable-next-line no-console
  .catch(err => console.error(err));

export default app;
