const mongoose = require('mongoose');

// recipientId === null && isGlobal === true  -> admin announcement (everyone)
// recipientId === <userId>                   -> personal notification
const notificationSchema = new mongoose.Schema({
   recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
   },
   isGlobal: {
      type: Boolean,
      default: false,
      index: true
   },
   type: {
      type: String,
      enum: [
         'payment_success',
         'payment_failed',
         'subscription_changed',
         'login',
         'artist_request_submitted',
         'artist_approved',
         'artist_rejected',
         'plan_price_changed',
         'admin_alert',
         'password_changed',
         'email_verified',
         'admin_announcement',
         // Admin and content notifications
         'account_banned',
         'account_unbanned',
         'subscription_cancelled_by_admin',
         'song_uploaded',
         'album_created'
      ],
      required: true
   },
   title: { type: String, required: true, trim: true },
   message: { type: String, required: true, trim: true },
   data: { type: mongoose.Schema.Types.Mixed, default: {} },
   isRead: { type: Boolean, default: false }, // meaningful for personal notifications only
   readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }] // used for global announcements
}, { timestamps: true });

notificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
