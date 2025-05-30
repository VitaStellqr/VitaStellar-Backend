import express from 'express';
import userController from '../controllers/userController.js';
import protect from '../middleware/authMiddleware.js';
import hasPermission from '../middleware/rbac.js';

const router = express.Router();

// Protect all routes
router.use(protect);

// Admin-only route to get all users
router.get('/', hasPermission('view_users'), userController.getAllUsers);

// Accessible by any logged-in user
router.get('/:id', hasPermission('view_own_record'), userController.getUserById);

export default router;
