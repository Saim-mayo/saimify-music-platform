const positiveNumber = (value, fallback) => {
   const parsed = Number(value);
   return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const durationMs = (envName, fallbackMinutes) => (
   positiveNumber(process.env[envName], fallbackMinutes) * 60 * 1000
);

const durationFromMs = (envName, fallbackMs) => positiveNumber(process.env[envName], fallbackMs);

const limits = Object.freeze({
   jsonBodyLimit: process.env.JSON_BODY_LIMIT || '10mb',
   authCookieMaxAgeMs: durationFromMs('AUTH_COOKIE_MAX_AGE_MS', 7 * 24 * 60 * 60 * 1000),
   passwordResetTtlMs: durationFromMs('PASSWORD_RESET_TTL_MS', 15 * 60 * 1000),
   emailVerificationTtlMs: durationFromMs('EMAIL_VERIFICATION_TTL_MS', 24 * 60 * 60 * 1000),
   refreshTokenTtlMs: durationFromMs('REFRESH_TOKEN_TTL_MS', 30 * 24 * 60 * 60 * 1000),
   refreshReuseGraceMs: durationFromMs('REFRESH_TOKEN_REUSE_GRACE_MS', 10 * 1000),
   rateLimitStoreTtlMs: durationMs('RATE_LIMIT_STORE_TTL_MINUTES', 60),
   global: {
      windowMs: durationMs('GLOBAL_RATE_LIMIT_WINDOW_MINUTES', 15),
      max: positiveNumber(process.env.GLOBAL_RATE_LIMIT_MAX, 100),
   },
   auth: {
      windowMs: durationMs('AUTH_RATE_LIMIT_WINDOW_MINUTES', 15),
      max: positiveNumber(process.env.AUTH_RATE_LIMIT_MAX, 20),
   },
   refresh: {
      windowMs: durationMs('REFRESH_RATE_LIMIT_WINDOW_MINUTES', 5),
      max: positiveNumber(process.env.REFRESH_RATE_LIMIT_MAX, 20),
   },
   search: {
      windowMs: durationMs('SEARCH_RATE_LIMIT_WINDOW_MINUTES', 1),
      max: positiveNumber(process.env.SEARCH_RATE_LIMIT_MAX, 60),
   },
   stream: {
      windowMs: durationMs('STREAM_RATE_LIMIT_WINDOW_MINUTES', 1),
      max: positiveNumber(process.env.STREAM_RATE_LIMIT_MAX, 150),
   },
   upload: {
      windowMs: durationMs('UPLOAD_RATE_LIMIT_WINDOW_MINUTES', 60),
      max: positiveNumber(process.env.UPLOAD_RATE_LIMIT_MAX, 25),
   },
   payment: {
      windowMs: durationMs('PAYMENT_RATE_LIMIT_WINDOW_MINUTES', 10),
      max: positiveNumber(process.env.PAYMENT_RATE_LIMIT_MAX, 15),
   },
   admin: {
      windowMs: durationMs('ADMIN_RATE_LIMIT_WINDOW_MINUTES', 5),
      max: positiveNumber(process.env.ADMIN_RATE_LIMIT_MAX, 100),
   },
});

module.exports = limits;
