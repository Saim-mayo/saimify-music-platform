const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/auth.middleware');
const { requireAdmin } = require('../middlewares/permission.middleware');
const adminController = require('../controllers/admin.controller');
const planAdminController = require('../controllers/planAdmin.controller');
const {
    adminLimiter
} = require("../middlewares/rateLimit.middleware");
const { sendAnnouncementValidator } = require('../validators/notification.validator');
const validate = require('../middlewares/validate.middleware');
const { reconcileSubscriptions } = require('../services/subscriptionReconciliation.service');
router.use(adminLimiter);

router.post('/subscriptions/reconcile', authMiddleware, requireAdmin, async (req, res, next) => {
    try {
        const report = await reconcileSubscriptions({
            dryRun: req.query.dryRun === 'true'
        });
        return res.status(200).json({ success: true, report });
    } catch (error) {
        return next(error);
    }
});
// =====================================
// ARTIST MANAGEMENT
// =====================================

/**
 * @openapi
 * /admin/artists/pending:
 *   get:
 *     summary: List users with a pending artist verification request (admin only)
 *     tags: [Admin]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: Paginated list of pending artist requests }
 *       403: { description: Admin only }
 */
/**
 * @openapi
 * /admin/users:
 *   get:
 *     summary: Search and list users for admin moderation (admin only)
 *     tags: [Admin]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: role
 *         schema: { type: string }
 *       - in: query
 *         name: isBanned
 *         schema: { type: string, enum: [true, false] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: Paginated list of users }
 *       403: { description: Admin only }
 */
router.get('/users', authMiddleware, requireAdmin, adminController.listUsers);

router.get('/artists/pending', authMiddleware, requireAdmin, adminController.getPendingArtists);

/**
 * @openapi
 * /admin/artists/{userId}/approve:
 *   patch:
 *     summary: Approve a pending artist request (promotes to artist role, forces logout on all devices)
 *     tags: [Admin]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Artist approved successfully }
 *       400: { description: Artist request not pending }
 *       404: { description: User not found }
 */
router.patch('/artists/:userId/approve', authMiddleware, requireAdmin, adminController.approveArtist);

/**
 * @openapi
 * /admin/artists/{userId}/reject:
 *   patch:
 *     summary: Reject a pending artist request
 *     tags: [Admin]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Artist rejected }
 *       400: { description: Artist request not pending }
 *       404: { description: User not found }
 */
router.patch('/artists/:userId/reject', authMiddleware, requireAdmin, adminController.rejectArtist);

// =====================================
// USER MANAGEMENT
// =====================================

/**
 * @openapi
 * /admin/users/{userId}/ban:
 *   patch:
 *     summary: Ban a user (invalidates all sessions/JWTs)
 *     tags: [Admin]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: User banned successfully }
 *       400: { description: Cannot ban your own account }
 *       404: { description: User not found }
 *       409: { description: User is already banned }
 */
router.patch('/users/:userId/ban', authMiddleware, requireAdmin, adminController.banUser);

/**
 * @openapi
 * /admin/users/{userId}/unban:
 *   patch:
 *     summary: Unban a user
 *     tags: [Admin]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: User unbanned successfully }
 *       404: { description: User not found }
 *       409: { description: User is not banned }
 */
router.patch('/users/:userId/unban', authMiddleware, requireAdmin, adminController.unbanUser);

// =====================================
// PLAN CATALOG (manual Stripe resync — recovery path, see planAdmin.controller.js)
// =====================================

/**
 * @openapi
 * /admin/plans/cache:
 *   get:
 *     summary: Inspect the in-memory plan cache status (debug/recovery)
 *     tags: [Admin]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     responses:
 *       200: { description: Plan cache status }
 */
router.get('/plans/cache', authMiddleware, requireAdmin, planAdminController.getPlanCacheStatus);

/**
 * @openapi
 * /admin/plans/resync:
 *   post:
 *     summary: Manually resync a single Stripe product's plan data (recovery path if a webhook was missed)
 *     tags: [Admin]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     responses:
 *       200: { description: Product resynced }
 */
router.post('/plans/resync', authMiddleware, requireAdmin, planAdminController.resyncProduct);

/**
 * @openapi
 * /admin/plans/resync-all:
 *   post:
 *     summary: Manually resync every Stripe product's plan data
 *     tags: [Admin]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     responses:
 *       200: { description: All products resynced }
 */
router.post('/plans/resync-all', authMiddleware, requireAdmin, planAdminController.resyncAllProducts);

// =====================================
// NOTIFICATIONS (ADMIN BROADCAST)
// =====================================

/**
 * @openapi
 * /admin/announcements:
 *   post:
 *     summary: Broadcast an announcement notification to all users (admin only)
 *     tags: [Admin]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, message]
 *             properties:
 *               title: { type: string }
 *               message: { type: string }
 *     responses:
 *       201: { description: Announcement sent }
 */
router.post(
   '/announcements',
   authMiddleware,
   requireAdmin,
   sendAnnouncementValidator,
   validate,
   require('../controllers/notification.controller').sendAnnouncement
);

module.exports = router;
