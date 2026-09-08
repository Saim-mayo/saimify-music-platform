const nodemailer = require('nodemailer');
const env = require('../config/env');
/**
 * =====================================
 * 📧 EMAIL SERVICE
 * =====================================
 * Generic SMTP sender — works with any SMTP provider (Gmail app
 * password, Brevo, Mailtrap, SendGrid SMTP relay, etc.) via env vars,
 * so no vendor-specific SDK is required.
 *
 * DEV FALLBACK: if SMTP_HOST is not set (e.g. local development before
 * you've wired up a provider), emails are logged to the console instead
 * of failing the request. This keeps `npm run dev` and the test suite
 * working with zero email configuration.
 */

let transporter = null;

const getTransporter = () => {
   if (transporter) return transporter;

   if (!env.SMTP_HOST) return null;

   transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT) || 587,
      secure: env.SMTP_SECURE === 'true', // true for port 465, false for 587/25
      auth: env.SMTP_USER
         ? {
              user: env.SMTP_USER,
              pass: env.SMTP_PASS
           }
         : undefined
   });

   return transporter;
};

const sendPasswordResetEmail = async (toEmail, resetUrl) => {
   const t = getTransporter();

   if (!t) {
      // No SMTP configured — log the link instead of silently losing it.
      console.log(`📧 [DEV] Password reset link for ${toEmail}: ${resetUrl}`);
      return;
   }

   await t.sendMail({
      from: env.EMAIL_FROM || 'no-reply@spotify-clone.dev',
      to: toEmail,
      subject: 'Reset your password',
      html: `
         <p>You requested a password reset.</p>
         <p><a href="${resetUrl}">Click here to reset your password</a>.
         This link expires in 15 minutes.</p>
         <p>If you didn't request this, you can safely ignore this email.</p>
      `
   });
};

const sendVerificationEmail = async (toEmail, verifyUrl) => {
   const t = getTransporter();

   if (!t) {
      console.log(`📧 [DEV] Email verification link for ${toEmail}: ${verifyUrl}`);
      return;
   }

   await t.sendMail({
      from: env.EMAIL_FROM || 'no-reply@spotify-clone.dev',
      to: toEmail,
      subject: 'Verify your email',
      html: `
         <p>Welcome! Please verify your email address to activate your account.</p>
         <p><a href="${verifyUrl}">Click here to verify your email</a>.
         This link expires in 24 hours.</p>
         <p>If you didn't create this account, you can safely ignore this email.</p>
      `
   });
};

module.exports = { sendPasswordResetEmail, sendVerificationEmail };
