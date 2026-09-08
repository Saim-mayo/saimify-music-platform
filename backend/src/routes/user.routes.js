const AppError = require('../utils/appError');
const express = require('express');
const router = express.Router();
const multer = require('multer');

// middleware
const authMiddleware = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');

// controller
const userController = require('../controllers/user.controller');

// validator
const { updateProfileValidator, setPasswordValidator } = require('../validators/user.validator');
const validateAvatar = require('../validators/avatar.validator'); // ✅ FIXED IMPORT

// upload config
const upload = multer({
   storage: multer.memoryStorage(),

   limits: { fileSize: 5 * 1024 * 1024 }, // adjust if needed

   fileFilter: (req, file, cb) => {
      /**
       * 🔒 SECURITY: restrict file types
       */

      // avatar → images only
      if (file.fieldname === 'avatar') {
         if (!file.mimetype.startsWith('image/')) {
            return cb(new AppError('Only image files allowed', 400), false);
         }
      }

      // music → audio only
      if (file.fieldname === 'music') {
         if (!file.mimetype.startsWith('audio/')) {
            return cb(new AppError('Only audio files allowed', 400), false);
         }
      }

      cb(null, true);
   }
});


// =====================================
// 👤 GET PROFILE
// =====================================
/**
 * @openapi
 * /users/me:
 *   get:
 *     summary: Get the current user's profile
 *     tags: [Users]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     responses:
 *       200: { description: Current user profile (no password/refreshToken) }
 */
router.get(
   '/me',
   authMiddleware,
   userController.getMyProfile
);


// =====================================
// 🎛 GET MY FEATURE FLAGS (ads / downloads / daily limit)
// =====================================
/**
 * @openapi
 * /users/me/features:
 *   get:
 *     summary: Get the current user's plan-derived feature flags (ads, downloads, daily play limit)
 *     tags: [Users]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     responses:
 *       200: { description: Feature flags for the user's current plan }
 */
router.get(
   '/me/features',
   authMiddleware,
   userController.getMyFeatures
);


// =====================================
// ✏️ UPDATE PROFILE
// =====================================
/**
 * @openapi
 * /users/me:
 *   patch:
 *     summary: Update the current user's username and/or bio
 *     tags: [Users]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username: { type: string }
 *               bio: { type: string, maxLength: 500 }
 *     responses:
 *       200: { description: Profile updated successfully }
 *       409: { description: Username already taken }
 */
router.patch(
   '/me',
   authMiddleware,
   updateProfileValidator,
   validate,
   userController.updateMyProfile
);


// =====================================
// 🖼️ UPLOAD AVATAR
// =====================================
/**
 * @openapi
 * /users/me/avatar:
 *   post:
 *     summary: Upload/replace the current user's avatar image
 *     tags: [Users]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [avatar]
 *             properties:
 *               avatar: { type: string, format: binary, description: "Image file, max 5MB" }
 *     responses:
 *       200: { description: Avatar uploaded successfully }
 *       400: { description: Invalid file type }
 */

router.post(
   '/me/avatar',
   authMiddleware,
   upload.single('avatar'),

   // ✅ validation layer (NEW CLEAN DESIGN)
   validateAvatar,

   userController.uploadAvatar
);
// =====================================
// SET PASSWORD
// =====================================

/**
 * @openapi
 * /users/set-password:
 *   patch:
 *     summary: Set a local password for a Google-only account (so it can also log in with email+password)
 *     tags: [Users]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password: { type: string, minLength: 8 }
 *     responses:
 *       200: { description: Password created successfully }
 *       400: { description: Password already exists }
 */
router.patch(

   '/set-password',

   authMiddleware,

   setPasswordValidator,

   validate,

   userController.setPassword

);
// =====================================
// 🎤 REQUEST ARTIST ACCESS
// =====================================
/**
 * @openapi
 * /users/artist/request:
 *   post:
 *     summary: Submit a request to become a verified artist (reviewed by an admin)
 *     tags: [Users]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     responses:
 *       200: { description: Artist request submitted successfully }
 *       409: { description: Already an artist, or a request is already pending }
 */
router.post(
   '/artist/request',
   authMiddleware,
   userController.requestArtistVerification
);

module.exports = router;