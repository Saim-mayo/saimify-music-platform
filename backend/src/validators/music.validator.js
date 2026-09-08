const { body } = require('express-validator');
const { param } = require('express-validator');
const createSongValidation = [
   body('title')
      .notEmpty()
      .withMessage('Title is required')
      .isLength({ min: 2, max: 120 })
      .withMessage('Title must be between 2 and 120 characters')
];

const updateSongValidation = [
   body('title')
      .optional()
      .isLength({ min: 2, max: 120 })
      .withMessage('Title must be between 2 and 120 characters'),
   body('visibility')
      .optional()
      .isIn(['public', 'private', 'unlisted'])
      .withMessage('Invalid visibility option'),
   body('premiumOnly')
      .optional()
      .isBoolean()
      .withMessage('premiumOnly must be boolean'),
   body('allowDownload')
      .optional()
      .isBoolean()
      .withMessage('allowDownload must be boolean'),
   body('genre')
      .optional()
      .isString()
      .withMessage('Genre must be a string')
];

const songIdValidator = [
   param('songId').isMongoId().withMessage('Invalid songId')
];

const albumIdValidator = [
   param('albumId').isMongoId().withMessage('Invalid albumId')
];
module.exports = {
   createSongValidation,
   songIdValidator,
   albumIdValidator
};
// Export update validation as well
module.exports.updateSongValidation = updateSongValidation;