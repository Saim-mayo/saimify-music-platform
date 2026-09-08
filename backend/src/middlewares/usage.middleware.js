const AppError = require('../utils/appError');
const userModel = require('../models/user.model');
const { isEntitled, getPlanFeatures } = require('../utils/accessControl');

const checkDailyLimit = async (req, res, next) => {
   try {
      // Browsers may issue multiple range requests during a single stream
      // session. Only the initial request for the song should consume a free
      // play credit; later partial requests with a start offset are just
      // continuation/seeking traffic and must not double-count.
      const range = String(req.headers?.range || '').trim();
      if (range && /^bytes=(\d+)-/.test(range)) {
         const start = Number(range.match(/^bytes=(\d+)-/)[1]);
         if (start > 0) {
            return next();
         }
      }

      // Any active paid tier (basic/pro/max) bypasses the free daily limit
      const userDoc = req.userDoc || req.user;
      const sub = userDoc?.subscription;

      if (sub?.plan !== 'free' && isEntitled(sub)) {
         return next();
      }

      // 1. Fetch the user configuration to determine the limit first
      const user = await userModel.findById(req.user.userId);
      if (!user) {
         return next(new AppError('User not found', 404));
      }

      const { dailyPlayLimit } = getPlanFeatures(user);

      if (req.isStreamAuthorization) {
         if (dailyPlayLimit !== null) {
            const today = new Date().toISOString().split('T')[0];
            const usage = user.dailyUsage;
            const playsToday = usage?.date === today ? Number(usage.plays || 0) : 0;
            if (playsToday >= dailyPlayLimit) {
               return next(new AppError('Daily limit reached', 403));
            }
         }
         return next();
      }

      // If the limit is null (unlimited), simply increment and bypass constraints safely
      if (dailyPlayLimit === null) {
         const today = new Date().toISOString().split('T')[0];

         const updatedUser = await userModel.findOneAndUpdate(
            { _id: req.user.userId },
            [
               {
                  $set: {
                     dailyUsage: {
                        $cond: {
                           if: { $ne: ['$dailyUsage.date', today] },
                           then: { date: today, plays: 1 },
                           else: { date: today, plays: { $add: ['$dailyUsage.plays', 1] } }
                        }
                     }
                  }
               }
            ],
            { new: true, updatePipeline: true }
         );

         req.userDoc = updatedUser;
         req.dbUser = updatedUser;

         return next();
      }

      const today = new Date().toISOString().split('T')[0];

      // 2. Atomic update: Reset counter or increment play count, ONLY if we are below limit
      const updatedUser = await userModel.findOneAndUpdate(
         {
            _id: req.user.userId,
            $or: [
               // Scenario A: It's a new day, so reset is permitted regardless of yesterday's plays
               { 'dailyUsage.date': { $ne: today } },
               // Scenario B: It's the same day, increment only if under the play limit
               { 'dailyUsage.date': today, 'dailyUsage.plays': { $lt: dailyPlayLimit } }
            ]
         },
         [
            {
               $set: {
                  dailyUsage: {
                     $cond: {
                        if: { $ne: ['$dailyUsage.date', today] },
                        then: { date: today, plays: 1 },
                        else: { date: today, plays: { $add: ['$dailyUsage.plays', 1] } }
                     }
                  }
               }
            }
         ],
         { new: true, updatePipeline: true } // Returns the newly updated document
      );

      // 3. If no document is returned, the user has exceeded their daily play limit
      if (!updatedUser) {
         return next(new AppError('Daily limit reached', 403));
      }

      req.userDoc = updatedUser;
      req.dbUser = updatedUser;

      next();
   } catch (error) {
      next(error);
   }
};

module.exports = {
   checkDailyLimit
};