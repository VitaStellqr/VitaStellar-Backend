import express from 'express';
import gdprController from '../controllers/gdprController.js';
import protect from '../middleware/authMiddleware.js';
import hasPermission from '../middleware/rbac.js';

const router = express.Router();

// Protect all routes and require admin role
router.use(protect);
router.use(hasPermission('gdpr_manage'));

/**
 * @swagger
 * /api/admin/gdpr-requests:
 *   get:
 *     summary: Get all GDPR requests
 *     description: Retrieve all GDPR requests for admin dashboard (Admin only)
 *     tags: [Admin, GDPR]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, processing, completed, failed]
 *         description: Filter by request status
 *       - in: query
 *         name: requestType
 *         schema:
 *           type: string
 *           enum: [export, delete]
 *         description: Filter by request type
 *     responses:
 *       200:
 *         description: GDPR requests retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     requests:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           userId:
 *                             type: object
 *                             properties:
 *                               _id:
 *                                 type: string
 *                               username:
 *                                 type: string
 *                               email:
 *                                 type: string
 *                               role:
 *                                 type: string
 *                           requestType:
 *                             type: string
 *                           status:
 *                             type: string
 *                           requestedBy:
 *                             type: object
 *                             properties:
 *                               _id:
 *                                 type: string
 *                               username:
 *                                 type: string
 *                               email:
 *                                 type: string
 *                               role:
 *                                 type: string
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           processingStartedAt:
 *                             type: string
 *                             format: date-time
 *                           processingCompletedAt:
 *                             type: string
 *                             format: date-time
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         pages:
 *                           type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/gdpr-requests', gdprController.getAllGDPRRequests);

/**
 * @swagger
 * /api/admin/gdpr-requests/{requestId}:
 *   get:
 *     summary: Get GDPR request details
 *     description: Get detailed information about a specific GDPR request (Admin only)
 *     tags: [Admin, GDPR]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *         description: GDPR request ID
 *     responses:
 *       200:
 *         description: GDPR request details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     userId:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         username:
 *                           type: string
 *                         email:
 *                           type: string
 *                         role:
 *                           type: string
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *                     requestType:
 *                       type: string
 *                     status:
 *                       type: string
 *                     requestedBy:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         username:
 *                           type: string
 *                         email:
 *                           type: string
 *                         role:
 *                           type: string
 *                     requestReason:
 *                       type: string
 *                     ipAddress:
 *                       type: string
 *                     userAgent:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     processingStartedAt:
 *                       type: string
 *                       format: date-time
 *                     processingCompletedAt:
 *                       type: string
 *                       format: date-time
 *                     errorMessage:
 *                       type: string
 *                     exportFormat:
 *                       type: string
 *                     downloadUrl:
 *                       type: string
 *                     deletionScheduledAt:
 *                       type: string
 *                       format: date-time
 *                     deletionCompletedAt:
 *                       type: string
 *                       format: date-time
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: GDPR request not found
 */
router.get('/gdpr-requests/:requestId', gdprController.getGDPRRequestDetails);

export default router;
