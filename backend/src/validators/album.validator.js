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
            } catch {
               return trimmed.split(',').map((item) => item.trim()).filter(Boolean).length > 0;
            }
         }

         return false;
      })
      .withMessage('At least one music is required')
];

const updateAlbumValidation = [
   body('title')
      .optional()
      .isLength({ min: 2, max: 100 })
      .withMessage('Album title must be 2-100 characters'),
   body('visibility')
      .optional()
      .isIn(['public', 'private'])
      .withMessage('Invalid album visibility option'),
   body('genre')
      .optional()
      .isString()
      .withMessage('Genre must be a string')
];

module.exports = {
   createAlbumValidation
};
// Export update validation too
module.exports.updateAlbumValidation = updateAlbumValidation;