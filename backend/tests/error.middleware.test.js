const AppError = require('../src/utils/appError');

const mockWarn = jest.fn();
const mockError = jest.fn();

jest.mock('../src/config/env', () => ({
   NODE_ENV: 'test'
}));

jest.mock('../src/config/logger', () => ({
   warn: mockWarn,
   error: mockError
}));

const errorHandler = require('../src/middlewares/error.middleware');

describe('error.middleware', () => {
   const createResponse = () => {
      const response = {
         statusCode: 200,
         payload: null,
         status(code) {
            this.statusCode = code;
            return this;
         },
         json(payload) {
            this.payload = payload;
            return this;
         }
      };

      return response;
   };

   beforeEach(() => {
      jest.clearAllMocks();
   });

   it('maps AppError to its status and message and logs a warning', () => {
      const req = { method: 'GET', originalUrl: '/api/test' };
      const res = createResponse();
      const next = jest.fn();

      errorHandler(new AppError('Bad request', 400), req, res, next);

      expect(res.statusCode).toBe(400);
      expect(res.payload).toEqual({ success: false, message: 'Bad request' });
      expect(mockWarn).toHaveBeenCalledWith(
         { method: 'GET', url: '/api/test', statusCode: 400 },
         'Bad request'
      );
   });

   it('maps multer file size and unexpected file errors to 400 responses', () => {
      const req = { method: 'POST', originalUrl: '/api/upload' };
      const res = createResponse();
      const multerError = new Error('Too many files');
      multerError.name = 'MulterError';
      multerError.code = 'LIMIT_UNEXPECTED_FILE';

      const multer = require('multer');
      const error = new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Too many files');

      errorHandler(error, req, res, jest.fn());
      expect(res.statusCode).toBe(400);
      expect(res.payload).toEqual({ success: false, message: 'Only one music file is allowed.' });
      expect(mockWarn).toHaveBeenCalled();

      const defaultMulter = Object.create(multer.MulterError.prototype);
      defaultMulter.code = 'LIMIT_FOO';
      defaultMulter.message = 'Custom multer issue';
      const res2 = createResponse();
      errorHandler(defaultMulter, req, res2, jest.fn());
      expect(res2.statusCode).toBe(400);
      expect(res2.payload).toEqual({ success: false, message: 'Custom multer issue' });
   });

   it('maps invalid audio/image type messages to 400 responses', () => {
      const req = { method: 'POST', originalUrl: '/api/music' };
      const res = createResponse();

      errorHandler(new Error('Only audio files allowed'), req, res, jest.fn());
      expect(res.statusCode).toBe(400);
      expect(res.payload).toEqual({ success: false, message: 'Only audio files allowed' });

      const res2 = createResponse();
      errorHandler(new Error('Only image files allowed'), req, res2, jest.fn());
      expect(res2.statusCode).toBe(400);
      expect(res2.payload).toEqual({ success: false, message: 'Only image files allowed' });
   });

   it('keeps AppError noisy in test mode but silent in production mode and covers the remaining multer switch cases', () => {
      const req = { method: 'POST', originalUrl: '/api/upload' };
      const multer = require('multer');

      const cases = [
         ['LIMIT_FILE_SIZE', 'File size exceeds the maximum limit of 10 MB.'],
         ['LIMIT_PART_COUNT', 'Too many form-data parts.'],
         ['LIMIT_FIELD_KEY', 'Field name is too long.'],
         ['LIMIT_FIELD_VALUE', 'Field value is too long.'],
         ['LIMIT_FIELD_COUNT', 'Too many fields were submitted.']
      ];

      for (const [code, message] of cases) {
         const res = createResponse();
         const mul = new multer.MulterError(code, 'boom');
         errorHandler(mul, req, res, jest.fn());
         expect(res.statusCode).toBe(400);
         expect(res.payload).toEqual({ success: false, message });
      }

      jest.clearAllMocks();
      jest.resetModules();
      jest.doMock('../src/config/env', () => ({ NODE_ENV: 'production' }));
      jest.doMock('../src/config/logger', () => ({ warn: mockWarn, error: mockError }));
      const AppErrorProd = require('../src/utils/appError');
      const productionHandler = require('../src/middlewares/error.middleware');
      const productionRes = createResponse();
      productionHandler(new AppErrorProd('Hidden app error', 403), req, productionRes, jest.fn());

      expect(productionRes.statusCode).toBe(403);
      expect(productionRes.payload).toEqual({ success: false, message: 'Hidden app error' });
      expect(mockWarn).not.toHaveBeenCalled();
   });

   it('maps CastError to invalid ID format', () => {
      const req = { method: 'GET', originalUrl: '/api/music/abc' };
      const res = createResponse();
      const err = new Error('Cast to ObjectId failed');
      err.name = 'CastError';

      errorHandler(err, req, res, jest.fn());

      expect(res.statusCode).toBe(400);
      expect(res.payload).toEqual({ success: false, message: 'Invalid ID format' });
   });

   it('maps duplicate keys to 409 and JWT failures to 401', () => {
      const req = { method: 'POST', originalUrl: '/api/auth/register' };
      const res = createResponse();
      const duplicateErr = new Error('duplicate');
      duplicateErr.code = 11000;

      errorHandler(duplicateErr, req, res, jest.fn());
      expect(res.statusCode).toBe(409);
      expect(res.payload).toEqual({ success: false, message: 'Duplicate entry found' });

      const invalidTokenRes = createResponse();
      const jwtError = new Error('bad token');
      jwtError.name = 'JsonWebTokenError';
      errorHandler(jwtError, req, invalidTokenRes, jest.fn());
      expect(invalidTokenRes.statusCode).toBe(401);
      expect(invalidTokenRes.payload).toEqual({ success: false, message: 'Invalid token' });

      const expiredTokenRes = createResponse();
      const expiredTokenError = new Error('expired');
      expiredTokenError.name = 'TokenExpiredError';
      errorHandler(expiredTokenError, req, expiredTokenRes, jest.fn());
      expect(expiredTokenRes.statusCode).toBe(401);
      expect(expiredTokenRes.payload).toEqual({ success: false, message: 'Access token expired' });
   });

   it('returns the original message in non-production and a generic message in production', () => {
      const req = { method: 'GET', originalUrl: '/api/debug' };
      const res = createResponse();
      const next = jest.fn();

      errorHandler(new Error('Boom'), req, res, next);
      expect(res.statusCode).toBe(500);
      expect(res.payload).toEqual({ success: false, message: 'Boom' });

      jest.resetModules();
      jest.doMock('../src/config/env', () => ({ NODE_ENV: 'production' }));
      jest.doMock('../src/config/logger', () => ({ warn: mockWarn, error: mockError }));
      const productionHandler = require('../src/middlewares/error.middleware');
      const productionRes = createResponse();
      productionHandler(new Error('Boom'), req, productionRes, next);
      expect(productionRes.statusCode).toBe(500);
      expect(productionRes.payload).toEqual({ success: false, message: 'Something went wrong' });
   });

   it('falls back to the generic error message when an unexpected error has no message', () => {
      const req = { method: 'GET', originalUrl: '/api/debug' };
      const res = createResponse();
      const next = jest.fn();
      const err = { name: 'Error' };

      errorHandler(err, req, res, next);
      expect(res.statusCode).toBe(500);
      expect(res.payload).toEqual({ success: false, message: 'Internal Server Error' });
   });
});
