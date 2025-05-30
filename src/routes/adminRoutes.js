import express from 'express';
import { backupDatabase, restoreDatabase } from '../controllers/dbController.js';
import protect from '../middleware/authMiddleware.js';
import hasPermission from '../middleware/rbac.js';

const router = express.Router();

// Protect and restrict to admin
router.post('/backup', protect, hasPermission('manage_users'), backupDatabase);
router.post('/restore', protect, hasPermission('manage_users'), ...restoreDatabase);

export default router;
