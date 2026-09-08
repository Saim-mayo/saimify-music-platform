const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const env = require('../config/env');
const logger = require('../config/logger');

const authMiddleware = async (req, res, next) => {

   try {

      // ==========================
      // GET TOKEN (COOKIE FIRST)
      // ==========================
      let token = null;

      if (req.cookies && req.cookies.accessToken) {
         token = req.cookies.accessToken;
      }
      else if (
         req.headers.authorization &&
         req.headers.authorization.startsWith('Bearer ')
      ) {
         token = req.headers.authorization.split(' ')[1];
      }

      if (!token) {
         return res.status(401).json({
            message: 'Unauthorized'
         });
      }

      // ==========================
      // VERIFY JWT
      // ==========================
      let decoded = null
      try {
         decoded = jwt.verify(
            token,
            env.JWT_ACCESS_SECRET
         )
      } catch (verifyError) {
         if (verifyError.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Access token expired' })
         }
         if (verifyError.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Invalid token' })
         }
         throw verifyError
      }

      let user = null
      if (decoded) {
         // ==========================
         // LOAD USER FROM DATABASE
         // ==========================
         user = await User.findById(decoded.userId).select(
            'username email role subscription artistVerification isBanned dailyUsage tokenVersion'
         )

         if (!user) {
            return res.status(401).json({
               message: 'User not found'
            })
         }

         if (decoded.tokenVersion !== user.tokenVersion) {
            return res.status(401).json({
               message: 'Session expired. Please login again'
            })
         }
      }

      if (!user) return res.status(401).json({ message: 'Unauthorized' })

      // ==========================
      // TOKEN VERSION CHECK
      // ==========================
      if (decoded && decoded.tokenVersion !== user.tokenVersion) {
         return res.status(401).json({
            message: 'Session expired. Please login again'
         })
      }

      // ==========================
      // BANNED USER
      // ==========================
      if (user.isBanned) {
         return res.status(403).json({
            message: 'Account banned'
         })
      }

      // ==========================
      // AUTO EXPIRE PREMIUM (ISSUE 9 FIXED)
      // ==========================
      if (
         user.subscription?.expiresAt &&
         new Date(user.subscription.expiresAt) < new Date()
      ) {
         // Atomic conditional update to prevent concurrent request write races.
         // We only update the DB if the subscription is not already marked as "free" or "expired".
         const updatedUser = await User.findOneAndUpdate(
            {
               _id: user._id,
               'subscription.plan': { $ne: 'free' }
            },
            {
               $set: {
                  'subscription.plan': 'free',
                  'subscription.billingInterval': null,
                  'subscription.status': 'expired'
               }
            },
            { new: true } // Returns the newly modified document
         );

         if (updatedUser) {
            // Apply updated state to our current request variables
            user.subscription = updatedUser.subscription;
         } else {
            // If another concurrent request processed the write first,
            // fall back to local-only changes in memory to avoid writing again.
            user.subscription.plan = 'free';
            user.subscription.billingInterval = null;
            user.subscription.status = 'expired';
         }
      }

      req.user = {
         userId: user._id,
         role: user.role,
         username: user.username,
         email: user.email,
         subscription: user.subscription,
         artistVerification: user.artistVerification,
         dailyUsage: user.dailyUsage,
         isBanned: user.isBanned
      };

      req.userDoc = user;
      req.dbUser = user;

      next();

   }

   catch (err) {

      logger.error({ err, method: req.method, url: req.originalUrl }, 'Authentication middleware error');

      if (err.name === 'TokenExpiredError') {
         return res.status(401).json({
            message: 'Access token expired'
         });
      }

      if (err.name === 'JsonWebTokenError') {
         return res.status(401).json({
            message: 'Invalid token'
         });
      }

      return res.status(500).json({
         message: 'Authentication error'
      });

   }

};

module.exports = authMiddleware;