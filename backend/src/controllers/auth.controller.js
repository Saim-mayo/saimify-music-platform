const asyncHandler = require("../utils/asyncHandler");
const env = require('../config/env');
const limits = require('../config/limits');
const { validationResult } = require("express-validator");

const userModel = require("../models/user.model");
const AppError = require("../utils/appError");

const {
   registerService,
   loginService,
   verifyEmailService,
   resendVerificationEmailService,
   requestPasswordResetService,
   resetPasswordService
} = require("../services/auth.service");

const {
   generateAccessToken
} = require("../utils/token");

const buildAuthValidationError = (errors) => new AppError('Validation error', 400, {
   code: 'AUTH_VALIDATION_ERROR',
   errors: errors.array(),
});

const {
   rotateToken,
   revokeFamily,
   createTokenFamily
} = require("../utils/tokenStore");

const {
   createExchangeCode,
   consumeExchangeCode
} = require('../utils/oauthExchangeCode');
// ======================================================
// COOKIE OPTIONS
// ======================================================
// Auth cookies must be cross-site-capable for frontend requests and media
// playback, but some browsers reject SameSite=None without Secure in local
// HTTP contexts. Use lax in non-secure dev/proxy scenarios and none only
// over HTTPS or in production.
const cookieOptions = (req) => {
   const forwardedHost = req.headers['x-forwarded-host'] ? String(req.headers['x-forwarded-host']).split(':')[0] : null
   const hostForDomain = forwardedHost && forwardedHost !== 'localhost' ? forwardedHost : undefined
   const opts = {
      httpOnly: true,
      secure: env.NODE_ENV === 'production' || req.secure,
      sameSite: env.NODE_ENV === 'production' || req.secure ? 'none' : 'lax',
      maxAge: limits.authCookieMaxAgeMs,
      path: '/'
   }
   if (hostForDomain) opts.domain = hostForDomain
   return opts
}

// ======================================================
// REGISTER
// ======================================================
const registerUser = asyncHandler(async (req, res) => {

   const errors = validationResult(req);

   if (!errors.isEmpty()) {
      throw buildAuthValidationError(errors);
   }

   // Prevent privilege escalation
   delete req.body.role;

   const data = await registerService(req.body);

   res.cookie('accessToken', data.accessToken, cookieOptions(req));
   res.cookie('refreshToken', data.refreshToken, cookieOptions(req));

   return res.status(201).json({
      success: true,
      message: 'User created. Please check your email to verify your account.',
      ...(env.NODE_ENV !== 'production' && {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      }),
      user: {
         id: data.user.id,
         username: data.user.username,
         email: data.user.email,
         role: data.user.role,
         artistVerification: data.user.artistVerification
      }
   });

});

const loginUser = asyncHandler(async (req, res) => {

   const errors = validationResult(req);

   if (!errors.isEmpty()) {
      throw buildAuthValidationError(errors);
   }

   // Extract user-agent and IP for device tracking
   const userAgent = req.headers['user-agent'] || '';
   const ipAddress = req.ip || req.connection.remoteAddress || '';

   const data = await loginService({
      ...req.body,
      userAgent,
      ipAddress
   });

   res.cookie('accessToken', data.accessToken, cookieOptions(req));
   res.cookie('refreshToken', data.refreshToken, cookieOptions(req));

   return res.status(200).json({
      success: true,
      message: 'Login successful',
      ...(env.NODE_ENV !== 'production' && {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      }),
      user: {
         id: data.user.id,
         username: data.user.username,
         email: data.user.email,
         role: data.user.role,
         artistVerification: data.user.artistVerification
      }
   });

});


const refreshAccessToken = asyncHandler(async (req, res) => {
   let rawRefreshToken = req.cookies?.refreshToken

   if (!rawRefreshToken) {
      rawRefreshToken = req.body?.refreshToken
   }

   if (!rawRefreshToken) throw new AppError('Refresh token missing', 401);

   let newRaw, userId;

   try {
      ({ newRaw, userId } = await rotateToken(rawRefreshToken));
   } catch (err) {
      res.clearCookie('accessToken', cookieOptions(req));
      res.clearCookie('refreshToken', cookieOptions(req));

      if (err.message === 'TOKEN_REUSE') {
         throw new AppError('Security violation detected. Please login again.', 403);
      }
      if (err.message === 'TOKEN_EXPIRED') {
         throw new AppError('Session expired. Please login again.', 401);
      }
      throw new AppError('Invalid refresh token', 401);
   }

   const user = await userModel.findById(userId);
   if (!user) throw new AppError('User not found', 404);
   if (user.isBanned) throw new AppError('Account banned', 403, { reason: user.banReason || null });

   const newAccessToken = generateAccessToken({
      userId: user._id,
      role: user.role,
      tokenVersion: user.tokenVersion,
   });

   res.cookie('accessToken', newAccessToken, cookieOptions(req));
   res.cookie('refreshToken', newRaw, cookieOptions(req));

   return res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      ...(env.NODE_ENV !== 'production' && {
        accessToken: newAccessToken,
        refreshToken: newRaw,
      }),
   });
});

// ======================================================
// LOGOUT
// ======================================================
const logoutUser = asyncHandler(async (req, res) => {
   const rawToken =
      req.body?.refreshToken ||
      req.cookies?.refreshToken;
   if (rawToken) {
      await revokeFamily(rawToken).catch(() => { }); // best-effort
   }

   res.clearCookie('accessToken', cookieOptions(req));
   res.clearCookie('refreshToken', cookieOptions(req));

   return res.status(200).json({ success: true, message: 'Logout successful' });
});

// ======================================================
// GOOGLE LOGIN
// ======================================================
const googleLogin = asyncHandler(async (req, res) => {
   const user = req.user;
   if (!user) throw new AppError('Google authentication failed', 401);
   if (user.isBanned) throw new AppError('Account banned', 403, { reason: user.banReason || null });

   const exchangeCode = await createExchangeCode(user._id);
   const redirectUrl = new URL('/auth/google/callback', env.CLIENT_URL);
   redirectUrl.searchParams.set('code', exchangeCode);
   redirectUrl.searchParams.set('state', req.query.state);

   return res.redirect(302, redirectUrl.toString());
});

// ======================================================
// GOOGLE OAUTH EXCHANGE
// ======================================================
const googleExchange = asyncHandler(async (req, res) => {
   const { code } = req.body;
   if (!code) throw new AppError('Missing OAuth exchange code', 400);

   const userId = await consumeExchangeCode(code);
   if (!userId) throw new AppError('Invalid or expired OAuth exchange code', 401);

   const user = await userModel.findById(userId);
   if (!user) throw new AppError('Google authentication failed', 401);
   if (user.isBanned) throw new AppError('Account banned', 403, { reason: user.banReason || null });

   // Extract user-agent and IP for device tracking
   const userAgent = req.headers['user-agent'] || '';
   const ipAddress = req.ip || req.connection.remoteAddress || '';

   // Track device and check if it's new
   const { trackDeviceLogin } = require('../services/auth.service');
   const { createNotification } = require('../services/notification.service');
   
   user.lastLoginAt = new Date();
   const isNewDevice = await trackDeviceLogin(user, userAgent, ipAddress);

   const { raw: refreshToken } = await createTokenFamily(user._id);
   const accessToken = generateAccessToken({
      userId: user._id,
      role: user.role,
      tokenVersion: user.tokenVersion,
   });

   await user.save();

   // Only create notification for new devices
   if (isNewDevice) {
      await createNotification({
         userId: user._id,
         type: 'login',
         title: 'New device login',
         message: 'Your account was just signed in from a new device.',
         data: { loginAt: user.lastLoginAt, userAgent, ipAddress }
      });
   }

   const logger = require('../config/logger');
   logger.info({ userId: user._id, hasRefreshToken: !!refreshToken, hasAccessToken: !!accessToken }, 'OAuth exchange tokens created');

   res.cookie('accessToken', accessToken, cookieOptions(req));
   res.cookie('refreshToken', refreshToken, cookieOptions(req));

   logger.info({ userId: user._id }, 'OAuth exchange cookies set');

   return res.status(200).json({
      success: true,
      message: 'OAuth exchange successful',
   });
});

// ======================================================
// FORGOT PASSWORD
// ======================================================
const forgotPassword = asyncHandler(async (req, res) => {

   const errors = validationResult(req);

   if (!errors.isEmpty()) {
      throw buildAuthValidationError(errors);
   }

   await requestPasswordResetService(req.body.email);

   // Deliberately generic — never confirms/denies whether the email exists.
   return res.status(200).json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.'
   });

});

// ======================================================
// RESET PASSWORD
// ======================================================
const resetPassword = asyncHandler(async (req, res) => {

   const errors = validationResult(req);

   if (!errors.isEmpty()) {
      throw buildAuthValidationError(errors);
   }

   await resetPasswordService({
      token: req.body.token,
      newPassword: req.body.password
   });

   return res.status(200).json({
      success: true,
      message: 'Password reset successful. Please log in again.'
   });

});

// ======================================================
// VERIFY EMAIL
// ======================================================
const verifyEmail = asyncHandler(async (req, res) => {

   const token = req.query.token || req.body.token;

   await verifyEmailService(token);

   return res.status(200).json({
      success: true,
      message: 'Email verified successfully. You can now log in.'
   });

});

// ======================================================
// RESEND VERIFICATION EMAIL
// ======================================================
const resendVerification = asyncHandler(async (req, res) => {

   const errors = validationResult(req);

   if (!errors.isEmpty()) {
      throw buildAuthValidationError(errors);
   }

   await resendVerificationEmailService(req.body.email);

   // Deliberately generic — never confirms/denies whether the email
   // exists or is already verified (same anti-enumeration pattern as
   // forgot-password).
   return res.status(200).json({
      success: true,
      message: 'If an account with that email exists and is not yet verified, a new verification link has been sent.'
   });

});

module.exports = {
   registerUser,
   loginUser,
   refreshAccessToken,
   logoutUser,
   googleLogin,
   googleExchange,
   forgotPassword,
   resetPassword,
   verifyEmail,
   resendVerification
};