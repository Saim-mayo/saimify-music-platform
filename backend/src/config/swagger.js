const swaggerJsdoc = require('swagger-jsdoc');
const env = require('./env');
/**
 * =====================================
 * 📘 OPENAPI / SWAGGER CONFIG
 * =====================================
 * Generates the spec from JSDoc `@openapi` blocks placed directly above
 * route handlers (see src/routes/auth.routes.js for the fullest
 * example). Add more blocks to other route files the same way and
 * they'll show up here automatically — no separate spec file to keep
 * in sync by hand.
 */

const PORT = env.PORT || 3000;

const options = {
   definition: {
      openapi: '3.0.0',
      info: {
         title: 'Spotify Clone API',
         version: '1.0.0',
         description:
            'Backend REST API for a Spotify-like music streaming SaaS: ' +
            'JWT + Google OAuth authentication, playlists, queue, likes, ' +
            'Stripe subscriptions, and artist upload/verification.'
      },
      servers: [
         {
            url: `http://localhost:${PORT}/api`,
            description: 'Local development'
         },
         {
            url: 'https://your-api.onrender.com/api',
            description: 'Production (replace with your Render URL)'
         }
      ],
      components: {
         securitySchemes: {
            cookieAuth: {
               type: 'apiKey',
               in: 'cookie',
               name: 'accessToken',
               description:
                  'Set automatically on login/register/refresh. Used by browser clients.'
            },
            bearerAuth: {
               type: 'http',
               scheme: 'bearer',
               bearerFormat: 'JWT',
               description:
                  'Alternative to the cookie for non-browser clients (e.g. Postman, mobile): ' +
                  'send the accessToken returned in the JSON body (non-production only) as ' +
                  '`Authorization: Bearer <token>`.'
            }
         }
      }
   },
   // Where to look for `@openapi` JSDoc comments.
   apis: ['./src/routes/*.js', './src/app.js']
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
