const { body } = require('express-validator');

const registerValidation = [
   body('username')
      .trim()
      .isLength({ min: 3, max: 20 })
      .withMessage('Username must be between 3 and 20 characters')
      // ISSUE 14 FIX: Restrict username to alphanumeric, dots, hyphens, and underscores
      .matches(/^[a-zA-Z0-9_.-]+$/)
      .withMessage('Username can only contain letters, numbers, dots, hyphens, and underscores'),

   body('email')
      .isEmail()
      .withMessage('Invalid email')
      .normalizeEmail(),

   body('password')
      // ISSUE 5 FIX: Cap max length at 128 to mitigate bcrypt heavy CPU-exhaustion attacks
      .isLength({ min: 8, max: 128 })
      .withMessage('Password must be between 8 and 128 characters')
];

const loginValidation = [
   body('email')
      .optional()
      .isEmail()
      .normalizeEmail(),
   
   body('username')
      .optional()
      .isLength({ min: 3, max: 20 })
      .matches(/^[a-zA-Z0-9_.-]+$/)
      .withMessage('Invalid username format'),

   body('password')
      .notEmpty()
      .withMessage('Password required')
      .isLength({ max: 128 }) // Protection against excessively long brute force payloads
      .withMessage('Invalid password length'),

   body().custom((value) => {
      if (!value.email && !value.username) {
         throw new Error('Email or username required');
      }
      return true;
   })
];

const forgotPasswordValidation = [
   body('email')
      .isEmail()
      .withMessage('Invalid email')
      .normalizeEmail()
];

const resetPasswordValidation = [
   body('token')
      .notEmpty()
      .withMessage('Reset token is required'),

   body('password')
      // ISSUE 5 FIX: Cap max length here too to prevent DoS on the hashing process
      .isLength({ min: 8, max: 128 })
      .withMessage('Password must be between 8 and 128 characters')
];

const resendVerificationValidation = [
   body('email')
      .isEmail()
      .withMessage('Invalid email')
      .normalizeEmail()
];

module.exports = {
   registerValidation,
   loginValidation,
   forgotPasswordValidation,
   resetPasswordValidation,
   resendVerificationValidation
};