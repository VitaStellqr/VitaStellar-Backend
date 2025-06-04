import express from 'express';
import pdfController from '../controllers/pdfController.js';
import protect from '../middleware/authMiddleware.js';
import hasRole from '../middleware/hasRoles.js';

const router = express.Router();

// Protect all routes
router.use(protect);

// PDF generation route
router.get('/:id/pdf', hasRole('doctor', 'admin'), pdfController.generatePDF);

export default router; 