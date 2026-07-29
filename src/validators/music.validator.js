const { body } = require('express-validator');
const { param } = require('express-validator');
const createSongValidation = [
   body('title')
      .notEmpty()
      .withMessage('Title is required')
      .isLength({ min: 2, max: 120 })
      .withMessage('Title must be between 2 and 120 characters')
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