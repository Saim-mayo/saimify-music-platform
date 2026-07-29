const AppError = require('../utils/appError');
const userModel = require('../models/user.model');

// ==========================================
// 🔒 LOAD FRESH USER FROM DB (CRITICAL)
// ==========================================
const attachFreshUser = async (req, res, next) => {
   try {
      if (!req.user?.userId) {
         return next(new AppError('Unauthorized', 401));
      }

      const user = await userModel.findById(req.user.userId);

      if (!user) {
         return next(new AppError('User not found', 401));
      }

      // 🔒 BLOCK BANNED USERS IMMEDIATELY
      if (user.isBanned) {
         return next(new AppError('Account banned', 403));
      }

      req.dbUser = user; // attach fresh DB user state
      next();
   } catch (error) {
      next(error);
   }
};

// ==========================================
// 🎤 VERIFIED ARTIST (DB-Backed - High Security)
// ==========================================
const requireVerifiedArtist = [
   attachFreshUser,
   (req, res, next) => {
      const user = req.dbUser;

      if (user.role !== 'artist') {
         return next(new AppError('Artist only', 403));
      }

      if (user.artistVerification.status !== 'approved') {
         return next(new AppError('Artist not approved', 403));
      }

      if (!user.artistVerification.isVerified) {
         return next(new AppError('Artist not verified', 403));
      }

      next();
   }
];

// ==========================================
// 🛡 ADMIN (DB-Backed - High Security)
// ==========================================
const requireAdmin = [
   attachFreshUser,
   (req, res, next) => {
      if (req.dbUser.role !== 'admin') {
         return next(new AppError('Admin only', 403));
      }
      next();
   }
];

// ==========================================
// 👤 USER (DB-Backed - High Security)
// ==========================================
const requireUser = [
   attachFreshUser,
   (req, res, next) => {
      if (req.dbUser.role !== 'user') {
         return next(new AppError('User only', 403));
      }
      next();
   }
];

// ====================================================
// ⚡ JWT-ONLY CHECKS (Performance Optimized)
// Use ONLY for routes where eventual consistency is acceptable
// (e.g., non-critical GET routes). Trusts the JWT's role state.
// ====================================================

const isArtist = (req, res, next) => {
   if (!req.user) return next(new AppError('Unauthorized', 401));
   if (req.user.role !== 'artist') return next(new AppError('Artist only', 403));
   next();
};

const isAdmin = (req, res, next) => {
   if (!req.user) return next(new AppError('Unauthorized', 401));
   if (req.user.role !== 'admin') return next(new AppError('Admin only', 403));
   next();
};

module.exports = {
   requireVerifiedArtist,
   requireAdmin,
   requireUser,
   isArtist,  // Merged from old role.middleware
   isAdmin    // Merged from old role.middleware
};