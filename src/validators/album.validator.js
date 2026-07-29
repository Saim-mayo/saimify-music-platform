const { body } = require('express-validator');

const createAlbumValidation = [
   body('title')
      .notEmpty()
      .withMessage('Album title is required')
      .isLength({ min: 2, max: 100 })
      .withMessage('Album title must be 2-100 characters'),

   body('musics')
      .custom((value) => {
         if (Array.isArray(value) && value.length > 0) {
            return true;
         }

         if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) {
               return false;
            }

            try {
               const parsed = JSON.parse(trimmed);
               return Array.isArray(parsed) && parsed.length > 0;
            } catch (error) {
               return trimmed.split(',').map((item) => item.trim()).filter(Boolean).length > 0;
            }
         }

         return false;
      })
      .withMessage('At least one music is required')
];

module.exports = {
   createAlbumValidation
};