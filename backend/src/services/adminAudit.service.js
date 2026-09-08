const AdminActionLog = require('../models/adminActionLog.model');

/**
 * =====================================
 * 🧾 ADMIN AUDIT LOGGING
 * =====================================
 * Reusable helper for recording immutable admin actions against a user.
 */
const logAdminAction = async ({ admin, action, targetUser, metadata }) => {
   if (!admin || !targetUser || !action) {
      return null;
   }

   const logEntry = await AdminActionLog.create({
      adminId: admin._id || admin.userId,
      adminUsername: admin.username || admin.email || 'Admin',
      action,
      targetUserId: targetUser._id || targetUser.userId || targetUser.id,
      targetUsername: targetUser.username || targetUser.email || 'Unknown user',
      metadata: metadata || null
   });

   return logEntry;
};

module.exports = {
   logAdminAction
};
