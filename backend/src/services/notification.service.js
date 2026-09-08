const Notification = require('../models/notification.model');
const logger = require('../config/logger');

// Fire-and-forget everywhere it's called — a notification failure must
// never fail the payment/auth/admin flow that triggered it.
const createNotification = async ({ userId, type, title, message, data = {}, session }) => {
   try {
      const eventId = data?.stripeEventId;
      const invoiceId = data?.invoiceId;
      const query = {
         recipientId: userId,
         type
      };
      const dedupeCriteria = [];

      if (eventId) {
         dedupeCriteria.push({ 'data.stripeEventId': eventId });
      }
      if (invoiceId) {
         dedupeCriteria.push({ 'data.invoiceId': invoiceId });
      }

      if (dedupeCriteria.length) {
         query.$or = dedupeCriteria;
         const existing = await Notification.findOne(query).session(session || null);
         if (existing) return existing;
      }

      await Notification.create([{ recipientId: userId, type, title, message, data }], session ? { session } : undefined);
   } catch (err) {
      logger.error({ err, userId, type }, 'Failed to create notification (non-fatal)');
   }
};

const createAnnouncement = async ({ title, message, data = {} }) => {
   return Notification.create({ isGlobal: true, type: 'admin_announcement', title, message, data });
};

const listForUser = async (userId, { page = 1, limit = 20, unreadOnly = false } = {}) => {
   const filter = { $or: [{ recipientId: userId }, { isGlobal: true }] };

   const [items, total] = await Promise.all([
      Notification.find(filter)
         .sort({ createdAt: -1 })
         .skip((page - 1) * limit)
         .limit(limit)
         .lean(),
      Notification.countDocuments(filter)
   ]);

   const shaped = items
      .map((n) => {
         const isRead = n.isGlobal
            ? (n.readBy || []).some((id) => id.toString() === userId.toString())
            : n.isRead
         return {
            ...n,
            isRead,
            read: isRead,
         }
      })
      .filter((n) => !unreadOnly || !n.isRead);

   return { items: shaped, total, page, totalPages: Math.ceil(total / limit) };
};

const unreadCount = async (userId) => {
   const [personalUnread, globalTotal, globalRead] = await Promise.all([
      Notification.countDocuments({ recipientId: userId, isRead: false }),
      Notification.countDocuments({ isGlobal: true }),
      Notification.countDocuments({ isGlobal: true, readBy: userId })
   ]);
   return personalUnread + (globalTotal - globalRead);
};

const markAsRead = async (userId, notificationId) => {
   const n = await Notification.findById(notificationId);
   if (!n) return null;

   if (n.isGlobal) {
      await Notification.updateOne(
         { _id: notificationId, readBy: { $ne: userId } },
         { $push: { readBy: userId } }
      );
   } else if (n.recipientId?.toString() === userId.toString()) {
      n.isRead = true;
      await n.save();
   }
   return true;
};

const markAllAsRead = async (userId) => {
   await Notification.updateMany({ recipientId: userId, isRead: false }, { isRead: true });
   const globalIds = await Notification.find({ isGlobal: true, readBy: { $ne: userId } }).select('_id');
   if (globalIds.length) {
      await Notification.updateMany(
         { _id: { $in: globalIds.map((d) => d._id) } },
         { $addToSet: { readBy: userId } }
      );
   }
};

module.exports = { createNotification, createAnnouncement, listForUser, unreadCount, markAsRead, markAllAsRead };
