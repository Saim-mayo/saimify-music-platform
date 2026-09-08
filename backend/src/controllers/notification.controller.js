const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/appError');
const mongoose = require('mongoose');
const {
   listForUser,
   unreadCount,
   markAsRead,
   markAllAsRead,
   createAnnouncement
} = require('../services/notification.service');

const getMyNotifications = asyncHandler(async (req, res) => {
   const page = Math.max(parseInt(req.query.page) || 1, 1);
   const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
   const unreadOnly = req.query.unreadOnly === 'true';

   const result = await listForUser(req.user.userId, { page, limit, unreadOnly });
   return res.status(200).json({ success: true, ...result });
});

const getUnreadCount = asyncHandler(async (req, res) => {
   const count = await unreadCount(req.user.userId);
   return res.status(200).json({ success: true, count });
});

const markOneAsRead = asyncHandler(async (req, res) => {
   if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw new AppError('Invalid notification id', 400);
   }
   await markAsRead(req.user.userId, req.params.id);
   return res.status(200).json({ success: true, message: 'Marked as read' });
});

const markAllRead = asyncHandler(async (req, res) => {
   await markAllAsRead(req.user.userId);
   return res.status(200).json({ success: true, message: 'All notifications marked as read' });
});

// Admin-only: broadcast an announcement to every user
const sendAnnouncement = asyncHandler(async (req, res) => {
   const { title, message } = req.body;
   if (!title || !message) throw new AppError('title and message are required', 400);

   await createAnnouncement({ title, message });
   return res.status(201).json({ success: true, message: 'Announcement sent' });
});

module.exports = { getMyNotifications, getUnreadCount, markOneAsRead, markAllRead, sendAnnouncement };
