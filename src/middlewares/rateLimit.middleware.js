const rateLimit = require("express-rate-limit");
const MongoStore = require("rate-limit-mongo");
const env = require('../config/env');
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

// Retrieve MongoDB URI from your environment variables.
// PHASE 2 FIX: env.DATABASE_URL was dead code — env.js has never
// exported a DATABASE_URL (only MONGO_URI exists anywhere in this
// codebase's .env/.env.example), so that half of the `||` could never
// evaluate to anything but undefined. Removed the confusing fallback
// instead of leaving a variable name that implies a config option that
// doesn't exist.
const mongoUri = env.MONGO_URI;

if (!mongoUri && !IS_TEST) {
   console.warn("⚠️ Warning: MONGO_URI is not set in your environment. Rate limiting will default to in-memory fallback.");
}

/**
 * Shared MongoDB Store for Rate Limiting
 * Keeps state synced across multiple running instances/processes
 *
 * Also skipped in tests: .env.test's MONGO_URI points at a static
 * mongodb://127.0.0.1:27017/... connection string, but the test suite
 * actually runs against mongodb-memory-server on a random in-memory port
 * (see tests/testDb.js) — nothing is ever listening on 27017 during a
 * test run, so this store would just be a dead connection.
 */
const sharedStore = mongoUri && !IS_TEST
   ? new MongoStore({
        uri: mongoUri,
        collectionName: "rateLimits", // Dedicated collection for tracking limits
        expireTimeMs: 60 * 60 * 1000,  // Clean up documents older than 1 hour automatically
        errorHandler: (error) => {
           console.error("Rate Limit MongoStore Error:", error);
        }
     })
   : undefined; // Falls back to standard in-memory storage if MongoDB URL is missing

const authLimiter = rateLimit({
    store: sharedStore,
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkipRateLimit,
    message: { success: false, message: "Too many authentication attempts. Try again in 15 minutes." }
});

const refreshLimiter = rateLimit({
    store: sharedStore,
    windowMs: 5 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkipRateLimit,
    message: { success: false, message: "Too many refresh requests." }
});

const searchLimiter = rateLimit({
    store: sharedStore,
    windowMs: 1 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkipRateLimit,
    message: { success: false, message: "Search limit exceeded." }
});

const streamLimiter = rateLimit({
    store: sharedStore,
    windowMs: 1 * 60 * 1000,
    max: 150,
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkipRateLimit,
    message: { success: false, message: "Streaming rate exceeded." }
});

const uploadLimiter = rateLimit({
    store: sharedStore,
    windowMs: 60 * 60 * 1000,
    max: 25,
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkipRateLimit,
    message: { success: false, message: "Upload limit exceeded." }
});

const paymentLimiter = rateLimit({
    store: sharedStore,
    windowMs: 10 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkipRateLimit,
    message: { success: false, message: "Too many payment requests." }
});

const adminLimiter = rateLimit({
    store: sharedStore,
    windowMs: 5 * 60 * 1000,
    max: 100,
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