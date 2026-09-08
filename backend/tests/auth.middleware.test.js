const jwt = require('jsonwebtoken');

jest.mock('../src/config/logger', () => ({
   error: jest.fn()
}));

jest.mock('../src/models/user.model', () => ({
   findById: jest.fn(),
   findOneAndUpdate: jest.fn()
}));

const loadAuthMiddleware = () => {
   jest.resetModules();
   jest.doMock('../src/config/env', () => ({
      JWT_ACCESS_SECRET: 'test-secret'
   }));

   return require('../src/middlewares/auth.middleware');
};

const makeToken = (payload) => jwt.sign(payload, 'test-secret');

describe('auth.middleware', () => {
   let authMiddleware;
   let User;
   const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
   };

   beforeEach(() => {
      jest.clearAllMocks();
      authMiddleware = loadAuthMiddleware();
      User = require('../src/models/user.model');
   });

   it('returns 401 when no access token is present', async () => {
      const req = { headers: {}, cookies: {} };
      const next = jest.fn();

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
      expect(next).not.toHaveBeenCalled();
   });

   it('reads the bearer token from the Authorization header and attaches the user context', async () => {
      const user = {
         _id: 'user-1',
         username: 'alice',
         email: 'alice@example.com',
         role: 'user',
         subscription: { plan: 'free', status: 'active' },
         artistVerification: { status: 'approved', isVerified: true },
         dailyUsage: 6,
         isBanned: false,
         tokenVersion: 1
      };

      User.findById.mockReturnValue({
         select: jest.fn().mockResolvedValue(user)
      });

      const req = {
         headers: { authorization: `Bearer ${makeToken({ userId: 'user-1', tokenVersion: 1 })}` },
         cookies: {},
         method: 'GET',
         originalUrl: '/api/test'
      };
      const next = jest.fn();

      await authMiddleware(req, res, next);

      expect(User.findById).toHaveBeenCalledWith('user-1');
      expect(req.user).toEqual(expect.objectContaining({ userId: 'user-1', role: 'user' }));
      expect(req.dbUser).toEqual(user);
      expect(req.userDoc).toEqual(user);
      expect(next).toHaveBeenCalledTimes(1);
   });

   it('rejects a user whose token version no longer matches', async () => {
      User.findById.mockReturnValue({
         select: jest.fn().mockResolvedValue({
            _id: 'user-1',
            tokenVersion: 2,
            isBanned: false
         })
      });

      const req = {
         headers: { authorization: `Bearer ${makeToken({ userId: 'user-1', tokenVersion: 1 })}` },
         cookies: {},
         method: 'GET',
         originalUrl: '/api/test'
      };
      const next = jest.fn();

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Session expired. Please login again' });
   });

   it('rejects a banned user before attaching access', async () => {
      User.findById.mockReturnValue({
         select: jest.fn().mockResolvedValue({
            _id: 'user-1',
            tokenVersion: 1,
            isBanned: true
         })
      });

      const req = {
         headers: { authorization: `Bearer ${makeToken({ userId: 'user-1', tokenVersion: 1 })}` },
         cookies: {},
         method: 'GET',
         originalUrl: '/api/test'
      };
      const next = jest.fn();

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Account banned' });
   });

   it('returns 401 for an expired token', async () => {
      const expiredToken = jwt.sign({ userId: 'user-1', tokenVersion: 1 }, 'test-secret', { expiresIn: -1 });
      const req = {
         headers: { authorization: `Bearer ${expiredToken}` },
         cookies: {},
         method: 'GET',
         originalUrl: '/api/test'
      };
      const next = jest.fn();

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Access token expired' });
   });

   it('does not rotate a refresh cookie from protected middleware', async () => {
      const expiredToken = jwt.sign({ userId: 'user-1', tokenVersion: 1 }, 'test-secret', { expiresIn: -1 });
      const req = {
         headers: {},
         cookies: { accessToken: expiredToken, refreshToken: 'refresh-token-available' },
         method: 'GET',
         originalUrl: '/api/test'
      };
      const next = jest.fn();

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Access token expired' });
      expect(next).not.toHaveBeenCalled();
   });

   it('returns 401 for a malformed token', async () => {
      const req = {
         headers: { authorization: 'Bearer not-a-valid-jwt' },
         cookies: {},
         method: 'GET',
         originalUrl: '/api/test'
      };
      const next = jest.fn();

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid token' });
   });

   it('falls back to local-only subscription downgrade when the DB write races', async () => {
      const user = {
         _id: 'user-1',
         username: 'alice',
         email: 'alice@example.com',
         role: 'user',
         subscription: { plan: 'pro', status: 'active', expiresAt: new Date(Date.now() - 1000).toISOString() },
         artistVerification: { status: 'approved', isVerified: true },
         dailyUsage: 6,
         isBanned: false,
         tokenVersion: 1
      };

      User.findById.mockReturnValue({
         select: jest.fn().mockResolvedValue(user)
      });
      User.findOneAndUpdate.mockResolvedValue(null);

      const req = {
         headers: { authorization: `Bearer ${makeToken({ userId: 'user-1', tokenVersion: 1 })}` },
         cookies: {},
         method: 'GET',
         originalUrl: '/api/test'
      };
      const next = jest.fn();

      await authMiddleware(req, res, next);

      expect(User.findOneAndUpdate).toHaveBeenCalledTimes(1);
      expect(req.user.subscription.plan).toBe('free');
      expect(req.user.subscription.status).toBe('expired');
      expect(next).toHaveBeenCalledTimes(1);
   });
});
