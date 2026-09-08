const rateLimit = require("express-rate-limit");
const env = require('../config/env');
const limits = require('../config/limits');
// Jest sets NODE_ENV=test (see package.json "test" script). Rate limiting
// is irrelevant to what the test suite verifies, and worse, actively breaks
// it: every limiter shares one 20-req/15-min bucket, so a full run of
// auth.test.js alone issues 20+ requests against authLimiter-protected
// routes and starts failing later tests with 429s instead of the status
// codes they're actually asserting on. Skip limiting entirely in tests.
// For local development, also skip the limiters so manual UI testing isn't
// blocked by temporary throttling while the app is being exercised.
const IS_TEST = env.NODE_ENV === "test";
const IS_DEVELOPMENT = env.NODE_ENV === "development";
const SHOULD_SKIP_RATE_LIMITS = IS_TEST || IS_DEVELOPMENT;
const shouldSkipRateLimit = () => SHOULD_SKIP_RATE_LIMITS;

const authLimiter = rateLimit({
    ...limits.auth,
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkipRateLimit,
    message: { success: false, message: "Too many authentication attempts. Try again in 15 minutes." }
});

const refreshLimiter = rateLimit({
    ...limits.refresh,
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkipRateLimit,
    message: { success: false, message: "Too many refresh requests." }
});

const searchLimiter = rateLimit({
    ...limits.search,
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkipRateLimit,
    message: { success: false, message: "Search limit exceeded." }
});

const streamLimiter = rateLimit({
    ...limits.stream,
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkipRateLimit,
    message: { success: false, message: "Streaming rate exceeded." }
});

const uploadLimiter = rateLimit({
    ...limits.upload,
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkipRateLimit,
    message: { success: false, message: "Upload limit exceeded." }
});

const paymentLimiter = rateLimit({
    ...limits.payment,
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkipRateLimit,
    message: { success: false, message: "Too many payment requests." }
});

const adminLimiter = rateLimit({
    ...limits.admin,
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkipRateLimit,
    message: { success: false, message: "Admin rate exceeded." }
});

module.exports = {
    authLimiter,
    refreshLimiter,
    searchLimiter,
    streamLimiter,
    uploadLimiter,
    paymentLimiter,
    adminLimiter
};