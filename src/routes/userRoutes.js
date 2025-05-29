import express from 'express';
import userController from '../controllers/userController.js';
import protect from '../middleware/authMiddleware.js';
import hasRole from '../middleware/hasRoles.js';

const router = express.Router();

// Protect all routes
router.use(protect);

// Admin-only route to get all users
router.get('/', hasRole('admin'), userController.getAllUsers);

// Accessible by any logged-in user
router.get('/:id', userController.getUserById);

export default router;
