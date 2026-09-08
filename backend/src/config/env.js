const dotenv = require('dotenv');
const path = require('path');

const rootEnvPath = path.resolve(__dirname, '../../../.env');
const backendEnvPath = path.resolve(__dirname, '../../.env');

dotenv.config({ path: rootEnvPath, override: false });
dotenv.config({ path: backendEnvPath, override: false });

// Every var actually required for the server to function correctly at
// runtime. NOTE: this list grew after an audit found that the *previous*
// version of this file only whitelisted ~13 vars for export — every var
// used elsewhere in the app that wasn't on that list (CLIENT_URL,
// ADMIN_SEED_EMAIL, GOOGLE_CALLBACK_URL, ALLOWED_ORIGINS, SMTP_*, etc.)
// was silently resolving to `undefined` at every call site, even though
// it was correctly set in `.env`. That broke password-reset/verification
// email links ("undefined/verify-email?token=..."), the admin seed
// script (always threw "Missing ADMIN_SEED_EMAIL"), Google OAuth
// (missing callback URL), and CORS (silently fell back to the
// localhost-only default). Fixed by exporting every var the app reads,
// not just the ones with boot-time validation.
const REQUIRED_ENV_VARS = [
   'PORT',

   'MONGO_URI',

   'JWT_ACCESS_SECRET',
   'JWT_REFRESH_SECRET',
   'REFRESH_TOKEN_HMAC_SECRET',

   'STRIPE_SECRET_KEY',
   'STRIPE_WEBHOOK_SECRET',

   'IMAGE_KIT_PUBLIC_KEY',
   'IMAGE_KIT_PRIVATE_KEY',
   'IMAGE_KIT_URL_ENDPOINT',

   'GOOGLE_CLIENT_ID',
   'GOOGLE_CLIENT_SECRET',
   'GOOGLE_CALLBACK_URL',

   'ADMIN_SEED_PASSWORD',
   'ADMIN_SEED_EMAIL',

   // Without this, every password-reset/verification email link is built
   // as "undefined/verify-email?token=..." — a silent, hard-to-notice
   // production break rather than a boot failure, so it's required.
   'CLIENT_URL'
];

const missing = REQUIRED_ENV_VARS.filter(
   (key) => !process.env[key] || process.env[key].trim() === ''
);

const stripeKeyMode = process.env.STRIPE_SECRET_KEY?.match(/^(?:sk|rk)_(test|live)_/)?.[1] || null;
const webhookMode = process.env.STRIPE_WEBHOOK_MODE?.trim().toLowerCase() || null;
const productionUrls = [
   ['STRIPE_SUCCESS_URL', process.env.STRIPE_SUCCESS_URL],
   ['STRIPE_CANCEL_URL', process.env.STRIPE_CANCEL_URL],
   ['CLIENT_URL', process.env.CLIENT_URL],
   ['ALLOWED_ORIGINS', process.env.ALLOWED_ORIGINS]
];

if (process.env.NODE_ENV === 'production') {
   if (!stripeKeyMode) {
      missing.push('STRIPE_SECRET_KEY (must start with sk_test_, sk_live_, rk_test_, or rk_live_)');
   }

   if (!webhookMode || !['test', 'live'].includes(webhookMode)) {
      missing.push('STRIPE_WEBHOOK_MODE (must be test or live; whsec_ secrets do not encode mode)');
   } else if (stripeKeyMode && webhookMode !== stripeKeyMode) {
      throw new Error(
         `Stripe mode mismatch: STRIPE_SECRET_KEY is ${stripeKeyMode}, STRIPE_WEBHOOK_MODE is ${webhookMode}`
      );
   }

   const localhostUrls = productionUrls
      .filter(([, value]) => String(value || '').toLowerCase().includes('localhost'))
      .map(([key]) => key);

   if (localhostUrls.length) {
      throw new Error(
         `Production URL configuration cannot contain localhost: ${localhostUrls.join(', ')}`
      );
   }
}

if (missing.length) {
   console.error('\n❌ CRITICAL BOOT FAILURE');
   console.error('Missing required environment variables:\n');

   missing.forEach((key) => {
      console.error(`   • ${key}`);
   });

   console.error('\nPlease configure your environment before starting the server.\n');

   process.exit(1);
}

module.exports = Object.freeze({
   NODE_ENV: process.env.NODE_ENV || 'development',

   PORT: Number(process.env.PORT),

   MONGO_URI: process.env.MONGO_URI,

   JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
   JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
   REFRESH_TOKEN_HMAC_SECRET: process.env.REFRESH_TOKEN_HMAC_SECRET,

   ACCESS_TOKEN_EXPIRES: process.env.ACCESS_TOKEN_EXPIRES || '15m',
   REFRESH_TOKEN_EXPIRES: process.env.REFRESH_TOKEN_EXPIRES || '7d',

   STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
   STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
   STRIPE_WEBHOOK_MODE: webhookMode,
   STRIPE_SUCCESS_URL: process.env.STRIPE_SUCCESS_URL,
   STRIPE_CANCEL_URL: process.env.STRIPE_CANCEL_URL,
   STRIPE_AUTOMATIC_TAX: process.env.STRIPE_AUTOMATIC_TAX,

   IMAGE_KIT_PUBLIC_KEY: process.env.IMAGE_KIT_PUBLIC_KEY,
   IMAGE_KIT_PRIVATE_KEY: process.env.IMAGE_KIT_PRIVATE_KEY,
   IMAGE_KIT_URL_ENDPOINT: process.env.IMAGE_KIT_URL_ENDPOINT,

   GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
   GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
   GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL,

   ADMIN_SEED_EMAIL: process.env.ADMIN_SEED_EMAIL,
   ADMIN_SEED_PASSWORD: process.env.ADMIN_SEED_PASSWORD,

   CLIENT_URL: process.env.CLIENT_URL,
   ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,

   EMAIL_FROM: process.env.EMAIL_FROM,
   SMTP_HOST: process.env.SMTP_HOST,
   SMTP_PORT: process.env.SMTP_PORT,
   SMTP_SECURE: process.env.SMTP_SECURE,
   SMTP_USER: process.env.SMTP_USER,
   SMTP_PASS: process.env.SMTP_PASS
});
