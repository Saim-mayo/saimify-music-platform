const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const requestId = require('./middlewares/requestId.middleware');
const httpLogger = require('./middlewares/logger.middleware');
const logger = require('./config/logger');
const errorHandler = require('./middlewares/error.middleware');
const routes = require('./routes/index.routes');
const webhookRoutes = require('./routes/webhook.routes');
const passport = require('passport');
const env = require('./config/env');
require('./config/passport');
const app = express();
app.set('trust proxy', 1);
app.use(requestId);
app.use(httpLogger);
app.use('/api/webhook', webhookRoutes);
// PHASE 2 FIX: express.json() previously had no size cap, so any JSON
// route (not just uploads, which go through multer separately) accepted
// an unbounded request body — a single client could send a
// multi-gigabyte JSON payload and exhaust memory before any route
// handler or validator ever ran. 10mb comfortably covers real payloads
// (metadata, playlist edits, etc.) since actual file uploads use
// multer's own multipart limits, not this parser.
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(passport.initialize());

// Mounted before helmet() below: swagger-ui-express serves an HTML page
// with inline scripts/styles, which helmet's default Content-Security-Policy
// would otherwise block. Everything else still gets the full helmet policy.
if (env.NODE_ENV !== 'production') {
   app.use(
      '/api-docs',
      swaggerUi.serve,
      swaggerUi.setup(swaggerSpec)
   );
   logger.info({ path: '/api-docs', url: `http://localhost:${env.PORT}/api-docs` }, 'Swagger API Docs enabled');
}

// PHASE 2 FIX: helmet's default Cross-Origin-Resource-Policy is
// 'same-origin', which blocks a browser on a DIFFERENT origin (the
// frontend, per the CORS/ALLOWED_ORIGINS setup below) from loading
// audio streams and images served through this API — <audio>/<img>
// tags are subject to CORP just like fetch/XHR. Since this app is
// explicitly designed for a separate frontend origin (that's the whole
// reason ALLOWED_ORIGINS/CORS exists), 'cross-origin' is required for
// streaming/downloads to actually work in production, not a relaxation
// made for convenience.
app.use(helmet({
   crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

const allowedOrigins =
   env.ALLOWED_ORIGINS
      ? env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:5173', 'http://127.0.0.1:5173'];

app.use(
   cors({
      origin: allowedOrigins,
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'Range', 'range'],
      exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length']
   })
);

if (env.NODE_ENV === 'production') {
   app.use(
      rateLimit({
         windowMs: 15 * 60 * 1000,
         max: 100,
         message: 'Too many requests from this IP, please try again later.',
         standardHeaders: true,
         legacyHeaders: false
      })
   );
}


/**
 * @openapi
 * /health:
 *   get:
 *     summary: Liveness/readiness check
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Server is up
 */
app.get('/health', (req, res) => {
   const mongoose = require('mongoose');
   const dbUp = mongoose.connection.readyState === 1; // 1 = connected
   const memoryUsage = process.memoryUsage();

   res.status(dbUp ? 200 : 503).json({
      status: dbUp ? 'ok' : 'degraded',
      db: dbUp ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
         rss: memoryUsage.rss,
         heapTotal: memoryUsage.heapTotal,
         heapUsed: memoryUsage.heapUsed,
         external: memoryUsage.external
      }
   });
});


app.use('/api', routes);


app.use(errorHandler);

module.exports = app;