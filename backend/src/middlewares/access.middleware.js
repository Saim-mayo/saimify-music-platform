const AppError = require('../utils/appError');
const {
   canPlaySong,
   canDownloadSong,
   canUpload
} = require('../utils/accessControl');
const userModel = require('../models/user.model');

/**
 * Play song access validation.
 */
const allowPlay = async (req, res, next) => {
   try {
      const user = await userModel.findById(req.user.userId);

      if (!user) throw new AppError('User not found', 401);
      if (user.isBanned) throw new AppError('Account banned', 403);

      req.userDoc = user;

      const result = canPlaySong(user);
      req.access = result;

      next();
   } catch (err) {
      next(err);
   }
};

/**
 * ⬇ DOWNLOAD ACCESS (PREMIUM ONLY)
 */
const allowDownload = (req, res, next) => {
   try {
      canDownloadSong(req.user);
      next();
   } catch (err) {
      next(err);
   }
};

/**
 * 🎤 UPLOAD MUSIC (ARTIST ONLY)
 */
const allowUpload = (req, res, next) => {
   try {
      canUpload(req.user);
      next();
   } catch (err) {
      next(err);
   }
};

module.exports = {
   allowPlay,
   allowDownload,
   allowUpload
};