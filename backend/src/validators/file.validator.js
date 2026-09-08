const path = require('path');
const { fileTypeFromBuffer } = require('../utils/fileType');

const validateAudioFile = async (req, res, next) => {

   const file = req.files?.music?.[0] || req.file;

   if (!file) {
      return res.status(400).json({
         message: 'File is required'
      });
   }

   const detected = await fileTypeFromBuffer(file.buffer);
   const allowedMime = ['audio/mpeg', 'audio/wav', 'audio/x-wav'];

   if (!detected || !allowedMime.includes(detected.mime)) {
      return res.status(400).json({
         message: 'Only audio files allowed'
      });
   }

   const ext = path.extname(file.originalname).toLowerCase();

   if (!['.mp3', '.wav'].includes(ext)) {
      return res.status(400).json({
         message: 'Invalid file extension'
      });
   }

   if (file.size > 10 * 1024 * 1024) {
      return res.status(400).json({
         message: 'File too large (max 10MB)'
      });
   }

   const coverFile = req.files?.cover?.[0];
   if (coverFile) {
      const coverDetected = await fileTypeFromBuffer(coverFile.buffer);
      const allowedCoverMime = ['image/jpeg', 'image/png', 'image/webp'];
      if (!coverDetected || !allowedCoverMime.includes(coverDetected.mime)) {
         return res.status(400).json({
            message: 'Only JPEG, PNG, or WebP cover images are allowed'
         });
      }

      if (coverFile.size > 5 * 1024 * 1024) {
         return res.status(400).json({
            message: 'Cover image too large (max 5MB)'
         });
      }
   }

   next();
};

module.exports = validateAudioFile;