const mongoose = require('mongoose');

/**
 * =====================================
 * 🧾 ADMIN ACTION LOG
 * =====================================
 * Immutable audit trail for administrative actions that materially affect
 * user access or billing state. Denormalized user snapshots keep the log
 * readable even if the referenced accounts are later renamed or removed.
 */
const adminActionLogSchema = new mongoose.Schema({
   adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
   },
   adminUsername: {
      type: String,
      required: true,
      trim: true
   },
   action: {
      type: String,
      enum: ['ban_user', 'unban_user', 'cancel_subscription'],
      required: true,
      index: true
   },
   targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
   },
   targetUsername: {
      type: String,
      required: true,
      trim: true
   },
   metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null
   },
   createdAt: {
      type: Date,
      default: Date.now,
      index: true
   }
}, { timestamps: false });

adminActionLogSchema.index({ targetUserId: 1, createdAt: -1 });
adminActionLogSchema.index({ adminId: 1, createdAt: -1 });

module.exports = mongoose.model('AdminActionLog', adminActionLogSchema);
