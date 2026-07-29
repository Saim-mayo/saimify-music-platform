const crypto = require('crypto');
const userModel = require('../models/user.model');
const bcrypt = require('bcrypt');
const AppError = require('../utils/appError');
const env = require('../config/env');
const { generateAccessToken } = require('../utils/token');
const { createTokenFamily, revokeAllSessions } = require('../utils/tokenStore');
const { sendPasswordResetEmail, sendVerificationEmail } = require('./email.service');
const { createNotification } = require('./notification.service');
const logger = require('../config/logger');

const RESET_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const hashResetToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');
const hashToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

const normalize = (value) => value?.trim().toLowerCase();

// Best-effort: generates + sets a verification token on the given user
// doc (does NOT save it — caller saves) and emails it. Never throws.
const issueVerificationEmail = async (user) => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  user.emailVerificationTokenHash = hashToken(rawToken);
  user.emailVerificationExpires = new Date(Date.now() + VERIFY_TOKEN_TTL_MS);

  const verifyUrl = `${env.CLIENT_URL}/verify-email?token=${rawToken}`;
  await sendVerificationEmail(user.email, verifyUrl).catch((err) => {
    logger.warn({ err, email: user.email }, 'Failed to send verification email');
  });
};

// ======================================================
// REGISTER SERVICE
// ======================================================
const registerService = async ({ username, email, password }) => {
  email = normalize(email);
  username = username?.trim();

  const exists = await userModel.findOne({ $or: [{ email }, { username }] });
  if (exists) throw new AppError('User already exists', 409);

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await userModel.create({ username, email, password: hashedPassword, role: 'user' });

  // Local accounts start unverified — Google accounts are verified at
  // creation time in config/passport.js instead.
  await issueVerificationEmail(user);
  await user.save();

  const { raw: refreshToken } = await createTokenFamily(user._id);

  const accessToken = generateAccessToken({
    userId: user._id,
    role: user.role,
    tokenVersion: user.tokenVersion,
  });

  return { accessToken, refreshToken, user };
};

// ======================================================
// LOGIN SERVICE (OPTIMIZED: NO EXTRA FINDBYIDANDUPDATE)
// ======================================================
const loginService = async ({ email, username, password }) => {
  if (!email && !username) throw new AppError('Email or username required', 400);

  email = normalize(email);
 const user = await userModel
   .findOne({
      $or: [{ email }, { username }]
   })
   .select('+password');

  if (!user) throw new AppError('Invalid credentials', 401);
  if (user.isBanned) throw new AppError('Account is banned', 403);
  if (!user.password) throw new AppError('Please login using Google', 400);

  const match = await bcrypt.compare(password, user.password);
  if (!match) throw new AppError('Invalid credentials', 401);

  // Google-authenticated users are pre-verified by Google; only local
  // (password) accounts are gated on our own email verification.
  // Admin accounts are allowed to sign in even if their email is still
  // unverified so platform access is not blocked during onboarding.
  if (!user.isEmailVerified && user.role !== 'admin') {
    throw new AppError('Please verify your email before logging in', 403);
  }

  // New login = new token family (old family tokens become orphaned)
  const { raw: refreshToken } = await createTokenFamily(user._id);

  const accessToken = generateAccessToken({
    userId: user._id,
    role: user.role,
    tokenVersion: user.tokenVersion,
  });

  // === OPTIMIZATION: Mutating in-memory document saves an extra database round-trip ===
  user.lastLoginAt = new Date();
  await user.save();

  await createNotification({
    userId: user._id,
    type: 'login',
    title: 'New login',
    message: 'Your account was just signed in to.',
    data: { loginAt: user.lastLoginAt }
  });

  return { accessToken, refreshToken, user };
};

// ======================================================
// VERIFY EMAIL
// ======================================================
const verifyEmailService = async (token) => {
  if (!token) throw new AppError('Invalid or expired verification token', 400);

  const tokenHash = hashToken(token);

  const user = await userModel
    .findOne({
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpires: { $gt: new Date() }
    })
    .select('+emailVerificationTokenHash +emailVerificationExpires');

  if (!user) throw new AppError('Invalid or expired verification token', 400);

  user.isEmailVerified = true;
  user.emailVerificationTokenHash = null;
  user.emailVerificationExpires = null;
  await user.save();

  await createNotification({
    userId: user._id,
    type: 'email_verified',
    title: 'Email verified',
    message: 'Your email address has been successfully verified.'
  });
};

// ======================================================
// RESEND VERIFICATION EMAIL
// ======================================================
// Same anti-enumeration shape as forgot-password: always resolves the
// same way to the caller regardless of whether the email exists,
// is already verified, or is a Google-only account.
const resendVerificationEmailService = async (email) => {
  email = normalize(email);
 const user = await userModel
   .findOne({ email })
   .select('+password');

  if (!user || user.isEmailVerified || !user.password) return;

  await issueVerificationEmail(user);
  await user.save();
};

// ======================================================
// REQUEST PASSWORD RESET (forgot-password)
// ======================================================
// Always resolves the same way regardless of whether the email matches
// an account, a Google-only account, etc. — the controller returns one
// generic message either way, so this never tells a caller whether an
// email address exists in the system.
const requestPasswordResetService = async (email) => {
  email = normalize(email);
 const user = await userModel
   .findOne({ email })
   .select('+password');

  // Google-only accounts have no password to reset.
  if (!user || !user.password) return;

  const rawToken = crypto.randomBytes(32).toString('hex');

  user.passwordResetTokenHash = hashResetToken(rawToken);
  user.passwordResetExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await user.save();

  const resetUrl = `${env.CLIENT_URL}/reset-password?token=${rawToken}`;

  // Best-effort: a broken mail provider shouldn't surface as a 500 to
  // the caller (that would leak "this email exists" via error vs. no error).
  await sendPasswordResetEmail(user.email, resetUrl).catch((err) => {
    logger.warn({ err, email: user.email }, 'Failed to send password reset email');
  });
};

// ======================================================
// RESET PASSWORD
// ======================================================
const resetPasswordService = async ({ token, newPassword }) => {
  if (!token) throw new AppError('Invalid or expired reset token', 400);

  const tokenHash = hashResetToken(token);

  const user = await userModel
    .findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpires: { $gt: new Date() }
    })
    .select('+passwordResetTokenHash +passwordResetExpires');

  if (!user) throw new AppError('Invalid or expired reset token', 400);

  user.password = await bcrypt.hash(newPassword, 12);
  user.passwordResetTokenHash = null;
  user.passwordResetExpires = null;
  // Invalidate any already-issued access tokens too, not just refresh tokens.
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  // A password reset should end every existing session, on every device.
  await revokeAllSessions(user._id);

  await createNotification({
    userId: user._id,
    type: 'password_changed',
    title: 'Password changed',
    message: "Your password was just changed. If this wasn't you, contact support immediately."
  });
};

module.exports = {
  registerService,
  loginService,
  verifyEmailService,
  resendVerificationEmailService,
  requestPasswordResetService,
  resetPasswordService
};
