const app = require('./src/app');
const connectDB = require('./src/config/db');
const mongoose = require('mongoose');
const env = require('./src/config/env');
const logger = require('./src/config/logger');

logger.info({ env: env.NODE_ENV, port: env.PORT }, 'Starting Spotify Clone API');

let server;

// ====================================================
// GLOBAL ERROR HANDLERS
// ====================================================

process.on('uncaughtException', (err) => {
   logger.fatal({ err }, 'UNCAUGHT EXCEPTION, shutting down');
   process.exit(1);
});

process.on('unhandledRejection', (err) => {
   logger.fatal({ err }, 'UNHANDLED REJECTION, shutting down');

   if (server) {
      server.close(() => process.exit(1));
   } else {
      process.exit(1);
   }
});

// ====================================================
// START SERVER
// ====================================================

const startServer = async () => {
   try {
      await connectDB();

      server = app.listen(env.PORT, () => {
         logger.info({ port: env.PORT }, 'Server running');
      });
   } catch (error) {
      logger.fatal({ err: error }, 'Database connection failed');
      process.exit(1);
   }
};

// ====================================================
// GRACEFUL SHUTDOWN
// ====================================================

const gracefulShutdown = (signal) => {
   logger.info({ signal }, 'Received signal. Starting graceful shutdown...');

   if (!server) {
      process.exit(0);
   }

   server.close(async () => {
      logger.info('Express server closed. No more incoming requests');

      try {
         await mongoose.connection.close(false);
         logger.info('MongoDB connection closed successfully');
         process.exit(0);
      } catch (err) {
         logger.error({ err }, 'Error closing MongoDB connection');
         process.exit(1);
      }
   });

   setTimeout(() => {
      console.error('⚠️ Forcefully terminating process (shutdown timeout exceeded)');
      process.exit(1);
   }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ====================================================
// BOOT APPLICATION
// ====================================================

startServer();