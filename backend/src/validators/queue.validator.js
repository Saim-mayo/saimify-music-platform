const { body } = require('express-validator');

const addToQueueValidator = [
   body('songId')
      .notEmpty().withMessage('songId is required')
      .isMongoId().withMessage('Invalid songId')
];

const setQueueValidator = [
   body('queue')
      .isArray({ min: 1 }).withMessage('Queue must be a non-empty array'),
   body('queue.*')
      .isMongoId().withMessage('Queue items must be valid song IDs'),
   body('currentIndex')
      .optional()
      .isInt({ min: 0 }).withMessage('currentIndex must be a non-negative integer')
];

const toggleShuffleValidator = [
   body('shuffle')
   .isBoolean()
   .toBoolean()
   .withMessage('shuffle must be boolean')
];

const toggleRepeatValidator = [
   body('repeatMode')
      .isIn(['off', 'one', 'all'])
      .withMessage('Invalid repeatMode')
];

module.exports = {
   addToQueueValidator,
   setQueueValidator,
   toggleShuffleValidator,
   toggleRepeatValidator
};