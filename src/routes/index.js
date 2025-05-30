import express from 'express';
import userRoutes from './userRoutes.js';
import authRoutes from './authRoutes.js';
import recordRoutes from './recordRoutes.js';

const router = express.Router();

// Import route modules here
// import userRoutes from './userRoutes.js';
// import authRoutes from './authRoutes.js';

// Define routes
router.get('/', (req, res) => {
  res.json({ message: 'Welcome to Uzima Backend API' });
});

// Use route modules
router.use('/users', userRoutes);
router.use('/auth', authRoutes);
router.use('/records', recordRoutes);

export default router;
