const pino = require('pino');
const env = require('./env');

const isProduction = env.NODE_ENV === 'production';

const logger = pino({
   level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
   timestamp: pino.stdTimeFunctions.isoTime,
   redact: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["set-cookie"]',
      'res.headers["set-cookie"]',
      'req.body.password',
      'req.body.confirmPassword',
      'req.body.newPassword',
      'req.body.oldPassword',
      'req.body.token',
      'req.body.refreshToken',
      'req.body.accessToken',
      'req.body.jwt'
   ],
   serializers: {
      err: pino.stdSerializers.err,
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res
   }
});

module.exports = logger;
