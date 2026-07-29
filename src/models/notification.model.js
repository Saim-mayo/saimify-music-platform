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
         'artist_approved',
         'artist_rejected',
         'password_changed',
         'email_verified',
         'admin_announcement'
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
