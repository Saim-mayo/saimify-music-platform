const AppError = require('../utils/appError');

const validateAvatarUpload = async (req, res, next) => {
   try {
      const file = req.file;

      if (!file) {
         return next(new AppError('No avatar file provided', 400));
      }

      // 1. Allowed MIME types
      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

      // 2. Validate using magic bytes (binary file header analysis)
      // Dynamic import is used to seamlessly load the ESM 'file-type' module inside CommonJS
      const { fileTypeFromBuffer } = await import('file-type');
      const detected = await fileTypeFromBuffer(file.buffer);

      if (!detected || !allowedMimeTypes.includes(detected.mime)) {
         return next(
            new AppError(
               `Invalid file type. Only JPEG, PNG, and WEBP images are allowed. (Detected: ${detected ? detected.mime : 'Unknown/Text'})`, 
               400
            )
         );
      }

      // 3. Keep standard properties synced with the actual verified type
      file.mimetype = detected.mime;
      
      // Fix file extension if the client tampered with it
      const correctExt = detected.ext === 'jpg' ? 'jpeg' : detected.ext;
      const hasCorrectExtension = file.originalname.toLowerCase().endsWith(`.${correctExt}`);
      
      if (!hasCorrectExtension) {
         // Optionally rename or sanitize originalname to have the correct matched extension
         file.originalname = `${Date.now()}-avatar.${detected.ext}`;
      }

      next();
   } catch (error) {
      next(error);
   }
};

module.exports = validateAvatarUpload;