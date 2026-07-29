const mongoose = require('mongoose');
const env = require('./env');
const logger = require('./logger');
const { loadPlanCache } = require('../services/planCache.service');

// Observability only — Mongoose auto-reconnects on its own, these just
// make a mid-life drop/reconnect visible in logs instead of silent.
mongoose.connection.on('disconnected', () => {
   logger.warn('MongoDB disconnected. Mongoose will attempt to reconnect automatically.');
});

mongoose.connection.on('reconnected', () => {
   logger.info('MongoDB reconnected');
});

mongoose.connection.on('error', (err) => {
   logger.error({ err }, 'MongoDB connection error');
});

const connectDB = async () => {
   try {
      await mongoose.connect(env.MONGO_URI);

      logger.info('MongoDB connected');

      // 💎 Load the Stripe-synced plan catalog into memory before the
      // app starts accepting traffic — see services/planCache.service.js.
      // On a brand new environment with no Plan documents yet, this
      // just loads an empty cache (run scripts/syncPlans.js to seed it)
      // rather than failing boot.
      await loadPlanCache();

      logger.info('Plan cache loaded');
   } catch (error) {
      logger.fatal({ err: error }, 'MongoDB connection failed');
      process.exit(1);
   }
};

module.exports = connectDB;