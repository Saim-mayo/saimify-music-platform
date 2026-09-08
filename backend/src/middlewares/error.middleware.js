const multer = require('multer');
const AppError = require('../utils/appError');
const env = require('../config/env');
const logger = require('../config/logger');

const errorHandler = (err, req, res, next) => {

   let statusCode = 500;
   let message = 'Internal Server Error';

   // =====================================
   // CUSTOM APPLICATION ERRORS
   // =====================================
   if (err instanceof AppError) {

      statusCode = err.statusCode;
      message = err.message;

      // Expected operational errors
      if (env.NODE_ENV !== 'production') {
         logger.warn({ method: req.method, url: req.originalUrl, statusCode }, message);
      }
   }

   // =====================================
   // MULTER ERRORS
   // =====================================
   else if (err instanceof multer.MulterError) {

      switch (err.code) {

         case 'LIMIT_FILE_SIZE':
            statusCode = 400;
            message = 'File size exceeds the maximum limit of 10 MB.';
            break;

         case 'LIMIT_UNEXPECTED_FILE':
            statusCode = 400;
            message = 'Only one music file is allowed.';
            break;

         case 'LIMIT_PART_COUNT':
            statusCode = 400;
            message = 'Too many form-data parts.';
            break;

         case 'LIMIT_FIELD_KEY':
            statusCode = 400;
            message = 'Field name is too long.';
            break;

         case 'LIMIT_FIELD_VALUE':
            statusCode = 400;
            message = 'Field value is too long.';
            break;

         case 'LIMIT_FIELD_COUNT':
            statusCode = 400;
            message = 'Too many fields were submitted.';
            break;

         default:
            statusCode = 400;
            message = err.message;
      }

      logger.warn({ code: err.code, message }, 'Multer error');
   }

   // =====================================
   // INVALID FILE TYPES
   // =====================================
   else if (
      err.message === 'Only audio files allowed' ||
      err.message === 'Only image files allowed'
   ) {

      statusCode = 400;
      message = err.message;

      logger.warn({ method: req.method, url: req.originalUrl, message }, 'Invalid file type');
   }

   // =====================================
   // INVALID OBJECT ID
   // =====================================
   else if (err.name === 'CastError') {

      statusCode = 400;
      message = 'Invalid ID format';

      logger.warn({ method: req.method, url: req.originalUrl, errName: err.name }, message);
   }

   // =====================================
   // DUPLICATE KEY
   // =====================================
   else if (err.code === 11000) {

      statusCode = 409;
      message = 'Duplicate entry found';

      logger.warn({ method: req.method, url: req.originalUrl, errCode: err.code }, message);
   }

   // =====================================
   // JWT ERRORS
   // =====================================
   else if (err.name === 'JsonWebTokenError') {

      statusCode = 401;
      message = 'Invalid token';

      logger.warn({ method: req.method, url: req.originalUrl, errName: err.name }, message);
   }

   else if (err.name === 'TokenExpiredError') {

      statusCode = 401;
      message = 'Access token expired';

      logger.warn({ method: req.method, url: req.originalUrl, errName: err.name }, message);
   }

   // =====================================
   // UNKNOWN / UNEXPECTED ERRORS
   // =====================================
   else {

      logger.error({ err, method: req.method, url: req.originalUrl }, 'Unexpected error');

      if (env.NODE_ENV === 'production') {
         message = 'Something went wrong';
      }
      else {
         message = err.message || message;
      }
   }

   const payload = {
      success: false,
      message
   };

   if (err instanceof AppError && err.details && typeof err.details === 'object' && Object.keys(err.details).length) {
      Object.assign(payload, err.details);
   }

   return res.status(statusCode).json(payload);

};

module.exports = errorHandler;