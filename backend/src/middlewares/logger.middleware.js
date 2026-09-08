const pinoHttp = require('pino-http');
const logger = require('../config/logger');

module.exports = pinoHttp({
   logger,
   genReqId: (req) => req.id,
   customLogLevel: (req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
   },
   customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
   customErrorMessage: (req, res, err) => err ? err.message : `Request errored with status code ${res.statusCode}`
});