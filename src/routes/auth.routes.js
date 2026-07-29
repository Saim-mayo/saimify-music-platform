const express = require('express');
const router = express.Router();
const passport = require('passport');
const crypto = require('crypto');
const env = require('../config/env');
const authController = require('../controllers/auth.controller');

const {
   registerValidation,
   loginValidation,
   forgotPasswordValidation,
   resetPasswordValidation,
   resendVerificationValidation
} = require('../validators/auth.validator');

const {
   authLimiter,
   refreshLimiter
} = require('../middlewares/rateLimit.middleware');

// =====================================
// REGISTER
// =====================================

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Create a new account
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, password]
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 example: janedoe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: jane@example.com
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: password123
 *     responses:
 *       201:
 *         description: Account created. Sets accessToken/refreshToken cookies.
 *       400:
 *         description: Validation error
 *       409:
 *         description: Username or email already registered
 */
router.post(
   '/register',
   authLimiter,
   registerValidation,
   authController.registerUser
);

// =====================================
// LOGIN
// =====================================

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Log in with email or username + password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful. Sets accessToken/refreshToken cookies.
 *       400:
 *         description: Validation error
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Account is banned
 */
router.post(
   '/login',
   authLimiter,
   loginValidation,
   authController.loginUser
);

// =====================================
// GOOGLE LOGIN
// =====================================

/**
 * @openapi
 * /auth/google:
 *   get:
 *     summary: Start Google OAuth login (redirects to Google's consent screen)
 *     tags: [Auth]
 *     responses:
 *       302:
 *         description: Redirect to Google
 */
router.get('/google', (req, res, next) => {

   const state = crypto.randomBytes(32).toString('hex');

   res.cookie('oauth_state', state, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000
   });

   passport.authenticate('google', {
      scope: ['profile', 'email'],
      session: false,
      state: state
   })(req, res, next);

});

// =====================================
// GOOGLE CALLBACK
// =====================================

/**
 * @openapi
 * /auth/google/callback:
 *   get:
 *     summary: Google OAuth callback (called by Google, not directly by clients)
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: CSRF state token, validated against the oauth_state cookie
 *     responses:
 *       200:
 *         description: Google login successful. Sets accessToken/refreshToken cookies.
 *       403:
 *         description: OAuth state mismatch or account banned
 */
router.get(

   '/google/callback',

   (req, res, next) => {

      
      if (
         !req.query.state ||
         req.query.state !== req.cookies.oauth_state
      ) {
         return res.status(403).json({
            message: 'OAuth state mismatch'
         });
      }

      res.clearCookie('oauth_state');

      next();

   },

   passport.authenticate('google', {
      session: false
   }),

   authController.googleLogin

);

// =====================================
// FORGOT PASSWORD
// =====================================

/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     summary: Request a password reset email
 *     description: >
 *       Always returns 200 with a generic message, whether or not the
 *       email is registered — this prevents user enumeration. If SMTP
 *       isn't configured (local dev), the reset link is logged to the
 *       server console instead of emailed.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Generic confirmation message (always returned)
 *       400:
 *         description: Validation error
 */
router.post(
   '/forgot-password',
   authLimiter,
   forgotPasswordValidation,
   authController.forgotPassword
);

// =====================================
// RESET PASSWORD
// =====================================

/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     summary: Complete a password reset using the token from the emailed link
 *     description: >
 *       On success, invalidates the user's current password, current
 *       access tokens (tokenVersion bump), and every refresh
 *       token/session on every device.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token:
 *                 type: string
 *                 description: Raw token from the reset link's ?token= query param
 *               password:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Validation error, or invalid/expired token
 */
router.post(
   '/reset-password',
   authLimiter,
   resetPasswordValidation,
   authController.resetPassword
);

// =====================================
// VERIFY EMAIL
// =====================================

/**
 * @openapi
 * /auth/verify-email:
 *   get:
 *     summary: Verify a user's email using the token from the emailed link
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema: { type: string }
 *         description: Raw token from the verification link's ?token= query param
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Invalid or expired verification token
 */
router.get(
   '/verify-email',
   authLimiter,
   authController.verifyEmail
);

// Some clients prefer POSTing the token instead of a GET query param.
router.post(
   '/verify-email',
   authLimiter,
   authController.verifyEmail
);

// =====================================
// RESEND VERIFICATION EMAIL
// =====================================

/**
 * @openapi
 * /auth/resend-verification:
 *   post:
 *     summary: Resend the email verification link
 *     description: >
 *       Always returns 200 with a generic message, whether or not the
 *       email is registered or already verified — this prevents user
 *       enumeration. If SMTP isn't configured (local dev), the
 *       verification link is logged to the server console instead of
 *       emailed.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Generic confirmation message (always returned)
 *       400:
 *         description: Validation error
 */
router.post(
   '/resend-verification',
   authLimiter,
   resendVerificationValidation,
   authController.resendVerification
);

// =====================================
// REFRESH TOKEN
// =====================================

/**
 * @openapi
 * /auth/refresh-token:
 *   post:
 *     summary: Exchange a refresh token for a new access + refresh token pair
 *     description: >
 *       Reads the refresh token from the httpOnly cookie by default,
 *       falling back to the request body. Rotates on every call —
 *       reusing an already-rotated token is treated as a theft signal
 *       and revokes the whole token family (403).
 *     tags: [Auth]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Only needed if not sent via cookie (e.g. Postman)
 *     responses:
 *       200:
 *         description: Token refreshed
 *       401:
 *         description: Refresh token missing, invalid, or expired
 *       403:
 *         description: Token reuse detected — all sessions in the family were revoked
 */
router.post(
   '/refresh-token',
   refreshLimiter,
   authController.refreshAccessToken
);

// =====================================
// LOGOUT
// =====================================

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Log out and revoke the current refresh token family
 *     tags: [Auth]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Logout successful (clears cookies)
 */
router.post(
   '/logout',
   authController.logoutUser
);

module.exports = router;