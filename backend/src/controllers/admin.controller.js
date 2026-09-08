const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const userModel = require('../models/user.model');
const AppError = require('../utils/appError');
const RefreshToken = require('../models/refreshToken.model');
const AdminActionLog = require('../models/adminActionLog.model');
const musicModel = require('../models/music.model');
const albumModel = require('../models/album.model');
const Playlist = require('../models/playlist.model');
const { logAdminAction } = require('../services/adminAudit.service');
const { cancelStripeSubscription } = require('../services/stripe.service');
const { createNotification } = require('../services/notification.service');

// =====================================
// 👤 GET PENDING ARTISTS
// =====================================
const listUsers = asyncHandler(async (req, res) => {
   const page = Math.max(parseInt(req.query.page) || 1, 1);
   const limit = Math.max(parseInt(req.query.limit) || 20, 1);
   const search = (req.query.search || '').trim();
   const role = (req.query.role || '').trim();
   const isBanned = req.query.isBanned;

   const filter = {};

   if (search) {
      filter.$or = [
         { username: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
         { email: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }
      ];
   }

   if (role) {
      filter.role = role;
   }

   if (typeof isBanned === 'string') {
      if (isBanned === 'true') {
         filter.isBanned = true;
      } else if (isBanned === 'false') {
         filter.isBanned = false;
      }
   }

   const [users, total] = await Promise.all([
      userModel
         .find(filter)
         .select('_id username email role isBanned artistVerification.createdAt artistVerification.status subscription.plan subscription.billingInterval subscription.status subscription.stripeSubscriptionId createdAt')
         .sort({ createdAt: -1 })
         .skip((page - 1) * limit)
         .limit(limit)
         .lean(),

      userModel.countDocuments(filter)
   ]);

   return res.status(200).json({
      success: true,
      pagination: {
         totalItems: total,
         currentPage: page,
         totalPages: Math.ceil(total / limit)
      },
      users
   });
});

const getPendingArtists = asyncHandler(async (req, res) => {

   // =====================================
   // Pagination
   // =====================================
   const page = Math.max(parseInt(req.query.page) || 1, 1);
   const limit = Math.max(parseInt(req.query.limit) || 20, 1);

   const filter = {
      role: 'user',
      'artistVerification.status': 'pending'
   };

   const [artists, total] = await Promise.all([
      userModel
         .find(filter)
         .select('-password')
         .skip((page - 1) * limit)
         .limit(limit)
         .lean(),

      userModel.countDocuments(filter)
   ]);

   return res.status(200).json({
      success: true,
      pagination: {
         totalItems: total,
         currentPage: page,
         totalPages: Math.ceil(total / limit)
      },
      artists
   });

});

// =====================================
// ✅ APPROVE ARTIST
// =====================================
const approveArtist = asyncHandler(async (req, res) => {

   if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      throw new AppError('Invalid userId', 400);
   }

   const user = await userModel.findById(req.params.userId);

   if (!user) {
      throw new AppError('User not found', 404);
   }

   if (user.isBanned) {
      throw new AppError('Cannot approve banned user', 403);
   }

   if (user.artistVerification.status !== 'pending') {
      throw new AppError('Artist request not pending', 400);
   }

   // =====================================
   // Promote user to artist
   // =====================================
   user.role = 'artist';
   user.artistVerification.status = 'approved';
   user.artistVerification.isVerified = true;

   // Force logout on every device
   user.tokenVersion += 1;

   await user.save();

   // Remove refresh tokens
   await RefreshToken.deleteMany({
      userId: user._id
   });

   await createNotification({
      userId: user._id,
      type: 'artist_approved',
      title: 'Artist application approved',
      message: 'Your artist application has been approved. You can now upload music and create albums.',
      data: { reviewRoute: '/admin/artists' }
   });

   return res.status(200).json({
      success: true,
      message: 'Artist approved successfully'
   });

});

// =====================================
// ❌ REJECT ARTIST
// =====================================
const rejectArtist = asyncHandler(async (req, res) => {

   if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      throw new AppError('Invalid userId', 400);
   }

   const user = await userModel.findById(req.params.userId);

   if (!user) {
      throw new AppError('User not found', 404);
   }

   if (user.artistVerification.status !== 'pending') {
      throw new AppError('Artist request not pending', 400);
   }

   user.role = 'user';
   user.artistVerification.status = 'rejected';
   user.artistVerification.isVerified = false;

   // Logout all devices
   user.tokenVersion += 1;

   await user.save();

   // Remove refresh tokens
   await RefreshToken.deleteMany({
      userId: user._id
   });

   await createNotification({
      userId: user._id,
      type: 'artist_rejected',
      title: 'Artist application rejected',
      message: req.body?.reason ? `Your artist application was rejected. Reason: ${req.body.reason}` : 'Your artist application was rejected.',
      data: { reason: req.body?.reason || null, reviewRoute: '/admin/artists' }
   });

   return res.status(200).json({
      success: true,
      message: 'Artist rejected'
   });

});

// =====================================
// 🚫 BAN USER
// =====================================
const banUser = asyncHandler(async (req, res) => {

   if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      throw new AppError('Invalid userId', 400);
   }

   // =====================================
   // Prevent admin banning himself
   // =====================================
   if (req.params.userId === req.user.userId.toString()) {
      throw new AppError('Cannot ban your own account', 400);
   }

   const user = await userModel.findById(req.params.userId);

   if (!user) {
      throw new AppError('User not found', 404);
   }

   // =====================================
   // NEW FIX
   // Prevent banning already banned user
   // =====================================
   if (user.isBanned) {
      throw new AppError('User is already banned', 409);
   }

   user.isBanned = true;
   user.banReason = req.body?.reason || null;
   user.bannedAt = new Date();

   // Invalidate all JWTs
   user.tokenVersion += 1;

   await user.save();

   // Delete refresh tokens
   await RefreshToken.deleteMany({
      userId: user._id
   });

   const subscriptionId = user.subscription?.stripeSubscriptionId;
   const hasActivePaidSubscription = Boolean(
      subscriptionId &&
      ['active', 'trialing'].includes(user.subscription?.status) &&
      user.subscription?.plan && user.subscription.plan !== 'free'
   );

   if (hasActivePaidSubscription) {
      try {
         await cancelStripeSubscription(subscriptionId, { atPeriodEnd: false });
      } catch (stripeError) {
         await logAdminAction({
            admin: req.user,
            action: 'ban_user_stripe_cancel_failed',
            targetUser: user,
            metadata: {
               stripeSubscriptionId: subscriptionId,
               reason: req.body?.reason || null,
               errorMessage: stripeError?.message || 'Unknown Stripe cancellation error'
            }
         });
      }
   }

   // Notify the affected user about the ban
   createNotification({
      userId: user._id,
      type: 'account_banned',
      title: 'Account banned',
      message: `Your account has been banned by an administrator.${req.body?.reason ? ' Reason: ' + req.body.reason : ''}`,
      data: { reason: req.body?.reason || null }
   });

   await logAdminAction({
      admin: req.user,
      action: 'ban_user',
      targetUser: user,
      metadata: { reason: req.body?.reason || null }
   });

   return res.status(200).json({
      success: true,
      message: 'User banned successfully'
   });

});

// =====================================
// ✅ UNBAN USER
// =====================================
const unbanUser = asyncHandler(async (req, res) => {

   if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      throw new AppError('Invalid userId', 400);
   }

   const user = await userModel.findById(req.params.userId);

   if (!user) {
      throw new AppError('User not found', 404);
   }

   // =====================================
   // NEW FIX
   // Prevent unbanning an already active user
   // =====================================
   if (!user.isBanned) {
      throw new AppError('User is not banned', 409);
   }

   user.isBanned = false;
   user.banReason = null;
   user.bannedAt = null;

   // Invalidate all JWTs
   user.tokenVersion += 1;

   await user.save();

   // Delete refresh tokens
   await RefreshToken.deleteMany({
      userId: user._id
   });

   // Notify the affected user about the unban
   createNotification({
      userId: user._id,
      type: 'account_unbanned',
      title: 'Account unbanned',
      message: 'Your account has been unbanned by an administrator.',
      data: null
   });

   await logAdminAction({
      admin: req.user,
      action: 'unban_user',
      targetUser: user,
      metadata: null
   });

   return res.status(200).json({
      success: true,
      message: 'User unbanned successfully'
   });

});

const getAuditLog = asyncHandler(async (req, res) => {
   const page = Math.max(parseInt(req.query.page) || 1, 1);
   const limit = Math.max(parseInt(req.query.limit) || 20, 1);
   const { targetUserId, action, from, to } = req.query;

   const filter = {};

   if (targetUserId && mongoose.Types.ObjectId.isValid(targetUserId)) {
      filter.targetUserId = targetUserId;
   }

   if (action) {
      filter.action = action;
   }

   if (from || to) {
      filter.createdAt = {};
      if (from) {
         filter.createdAt.$gte = new Date(from);
      }
      if (to) {
         filter.createdAt.$lte = new Date(to);
      }
   }

   const [logs, total] = await Promise.all([
      AdminActionLog.find(filter)
         .sort({ createdAt: -1 })
         .skip((page - 1) * limit)
         .limit(limit)
         .lean(),
      AdminActionLog.countDocuments(filter)
   ]);

   return res.status(200).json({
      success: true,
      pagination: {
         totalItems: total,
         currentPage: page,
         totalPages: Math.ceil(total / limit)
      },
      logs
   });
});

const cancelUserSubscription = asyncHandler(async (req, res) => {
   if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      throw new AppError('Invalid userId', 400);
   }

   const user = await userModel.findById(req.params.userId);

   if (!user) {
      throw new AppError('User not found', 404);
   }

   const subscriptionId = user.subscription?.stripeSubscriptionId;

   if (!subscriptionId) {
      throw new AppError('No active subscription found', 404);
   }

   const result = await cancelStripeSubscription(subscriptionId, { atPeriodEnd: false });

   // Notify the user that their subscription was cancelled by an admin
   createNotification({
      userId: user._id,
      type: 'subscription_cancelled_by_admin',
      title: 'Subscription cancelled',
      message: 'Your subscription was cancelled by an administrator.',
      data: { stripeSubscriptionId: subscriptionId }
   });

   await logAdminAction({
      admin: req.user,
      action: 'cancel_subscription',
      targetUser: user,
      metadata: { stripeSubscriptionId: subscriptionId, stripeStatus: result?.status || null }
   });

   return res.status(200).json({
      success: true,
      message: 'Subscription cancelled successfully',
      subscription: {
         status: result?.status || 'canceled',
         stripeSubscriptionId: subscriptionId
      }
   });
});

const getAdminSongs = asyncHandler(async (req, res) => {
   const page = Math.max(parseInt(req.query.page) || 1, 1);
   const limit = Math.max(parseInt(req.query.limit) || 20, 1);
   const search = (req.query.search || '').trim();

   const filter = {
      deletedAt: null,
      isDeleted: false
   };

   if (search) {
      const query = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const artistMatch = { username: { $regex: query, $options: 'i' } };
      const artistIds = await userModel.find(artistMatch).select('_id').lean();
      filter.$or = [
         { title: { $regex: query, $options: 'i' } },
         { artist: { $in: artistIds.map((user) => user._id) } }
      ];
   }

   const [songs, total] = await Promise.all([
      musicModel.find(filter)
         .populate('artist', 'username avatar')
         .sort({ createdAt: -1 })
         .skip((page - 1) * limit)
         .limit(limit)
         .lean(),
      musicModel.countDocuments(filter)
   ]);

   return res.status(200).json({
      success: true,
      pagination: {
         totalItems: total,
         currentPage: page,
         totalPages: Math.ceil(total / limit)
      },
      songs
   });
});

const getAdminAlbums = asyncHandler(async (req, res) => {
   const page = Math.max(parseInt(req.query.page) || 1, 1);
   const limit = Math.max(parseInt(req.query.limit) || 20, 1);
   const search = (req.query.search || '').trim();

   const filter = {
      deletedAt: null,
      isDeleted: false
   };

   if (search) {
      const query = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const artistMatch = { username: { $regex: query, $options: 'i' } };
      const artistIds = await userModel.find(artistMatch).select('_id').lean();
      filter.$or = [
         { title: { $regex: query, $options: 'i' } },
         { artist: { $in: artistIds.map((user) => user._id) } }
      ];
   }

   const [albums, total] = await Promise.all([
      albumModel.find(filter)
         .populate('artist', 'username avatar')
         .populate('musics', 'title coverUrl')
         .sort({ createdAt: -1 })
         .skip((page - 1) * limit)
         .limit(limit)
         .lean(),
      albumModel.countDocuments(filter)
   ]);

   return res.status(200).json({
      success: true,
      pagination: {
         totalItems: total,
         currentPage: page,
         totalPages: Math.ceil(total / limit)
      },
      albums
   });
});

const getAdminPlaylists = asyncHandler(async (req, res) => {
   const page = Math.max(parseInt(req.query.page) || 1, 1);
   const limit = Math.max(parseInt(req.query.limit) || 20, 1);
   const search = (req.query.search || '').trim();

   const filter = {};
   if (search) {
      const query = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const ownerMatch = { username: { $regex: query, $options: 'i' } };
      const ownerIds = await userModel.find(ownerMatch).select('_id').lean();
      filter.$or = [
         { title: { $regex: query, $options: 'i' } },
         { user: { $in: ownerIds.map((owner) => owner._id) } }
      ];
   }

   const [playlists, total] = await Promise.all([
      Playlist.find(filter)
         .populate('user', 'username avatar role')
         .populate({
            path: 'songs',
            select: 'title artist',
            populate: { path: 'artist', select: 'username avatar' }
         })
         .sort({ createdAt: -1 })
         .skip((page - 1) * limit)
         .limit(limit)
         .lean(),
      Playlist.countDocuments(filter)
   ]);

   return res.status(200).json({
      success: true,
      pagination: {
         totalItems: total,
         currentPage: page,
         totalPages: Math.ceil(total / limit)
      },
      playlists
   });
});

const deleteAdminPlaylist = asyncHandler(async (req, res) => {
   const { removePlaylistService } = require('../services/playlist.service');

   await removePlaylistService(req.params.playlistId, req.user.userId, req.user.role);

   return res.status(200).json({
      success: true,
      message: 'Playlist deleted successfully'
   });
});

module.exports = {
   listUsers,
   getPendingArtists,
   approveArtist,
   rejectArtist,
   banUser,
   unbanUser,
   getAuditLog,
   cancelUserSubscription,
   getAdminSongs,
   getAdminAlbums,
   getAdminPlaylists,
   deleteAdminPlaylist
};