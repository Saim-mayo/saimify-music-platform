const express = require('express');
const router = express.Router();
const {
    requireAdmin
} = require('../middlewares/permission.middleware');
const authMiddleware = require('../middlewares/auth.middleware');
const notificationController = require('../controllers/notification.controller');

/**
 * @openapi
 * /notifications:
 *   get:
 *     summary: List my notifications (personal + global announcements)
 *     tags: [Notifications]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     responses:
 *       200: { description: Paginated notification list }
 */
router.get('/', authMiddleware, notificationController.getMyNotifications);

/**
 * @openapi
 * /notifications/unread-count:
 *   get:
 *     summary: Get my unread notification count
 *     tags: [Notifications]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     responses:
 *       200: { description: Unread count }
 */
router.get('/unread-count', authMiddleware, notificationController.getUnreadCount);

/**
 * @openapi
 * /notifications/{id}/read:
 *   patch:
 *     summary: Mark a single notification as read
 *     tags: [Notifications]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     responses:
 *       200: { description: Marked as read }
 */
router.patch('/:id/read', authMiddleware, notificationController.markOneAsRead);

/**
 * @openapi
 * /notifications/read-all:
 *   patch:
 *     summary: Mark all my notifications as read
 *     tags: [Notifications]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     responses:
 *       200: { description: All marked as read }
 */
router.patch('/read-all', authMiddleware, notificationController.markAllRead);

/**
 * @openapi
 * /notifications/announce:
 *   post:
 *     summary: Broadcast an announcement notification to all users (admin only)
 *     tags: [Notifications]
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
router.post('/announce', authMiddleware, requireAdmin, notificationController.sendAnnouncement);
module.exports = router;
