const { body } = require('express-validator');

const sendAnnouncementValidator = [
   body('title')
      .trim()
      .notEmpty().withMessage('title is required')
      .isLength({ max: 120 }).withMessage('title must be 120 characters or fewer'),

   body('message')
      .trim()
      .notEmpty().withMessage('message is required')
      .isLength({ max: 2000 }).withMessage('message must be 2000 characters or fewer')
];

module.exports = {
   sendAnnouncementValidator
};
