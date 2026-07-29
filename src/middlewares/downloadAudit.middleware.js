const DownloadLog = require('../models/downloadLog.model');

const logDownload = async (req, res, next) => {

   try {

      await DownloadLog.create({

         user: req.user.userId,

         song: req.song._id,

         // FIX: Trust Express proxy resolution (req.ip) completely.
         // Do not fall back to raw headers which can be easily spoofed by an attacker.
         ip: req.ip || 'unknown',

         userAgent: req.headers['user-agent'] || ''

      });

      next();

   } catch (err) {

      next(err);

   }

};

module.exports = {
   logDownload
};