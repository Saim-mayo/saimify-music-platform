const request = require('supertest');
const crypto = require('crypto');
const { connect, closeDatabase, clearDatabase } = require('./testDb');

let app;
let User;
let OAuthExchangeCode;
let mockGoogleUser = null;

jest.mock('passport', () => ({
   initialize: jest.fn(() => (req, res, next) => next()),
   authenticate: jest.fn((strategy, options) => {
      return (req, res, next) => {
         if (strategy === 'google' && options && options.session === false) {
            req.user = mockGoogleUser;
         }
         next();
      };
   }),
   use: jest.fn()
}));

jest.mock('passport-google-oauth20', () => ({
   Strategy: jest.fn(() => ({}))
}));

const HMAC_SECRET = process.env.OAUTH_EXCHANGE_SECRET || 'default_oauth_exchange_secret';

beforeAll(async () => {
   await connect();
   app = require('../src/app');
   User = require('../src/models/user.model');
   OAuthExchangeCode = require('../src/models/oauthExchangeCode.model');
});

afterEach(async () => {
   mockGoogleUser = null;
   await clearDatabase();
});

afterAll(async () => {
   await closeDatabase();
});

const createGoogleUser = async (overrides = {}) => {
   return User.create({
      username: overrides.username || `googleuser_${Date.now()}`,
      email: overrides.email || `googleuser_${Date.now()}@example.com`,
      googleId: overrides.googleId || `google-${Date.now()}`,
      provider: 'google',
      isEmailVerified: true,
      ...overrides
   });
};

const makeExpiredCode = async (rawCode, userId) => {
   const codeHash = crypto.createHmac('sha256', HMAC_SECRET).update(rawCode).digest('hex');
   await OAuthExchangeCode.create({
      codeHash,
      userId,
      expiresAt: new Date(Date.now() - 1000)
   });
   return rawCode;
};

describe('Google OAuth exchange flow', () => {
   it('registers /api/auth/oauth/exchange and returns 400 when no code is provided', async () => {
      const res = await request(app).post('/api/auth/oauth/exchange').send({});
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Missing OAuth exchange code');
   });

   it('creates an exchange code on successful Google callback and includes it in the redirect query', async () => {
      const user = await createGoogleUser({ email: 'existing@example.com' });
      mockGoogleUser = user;
      const state = 'test-state-123';
      const res = await request(app)
         .get(`/api/auth/google/callback?state=${state}`)
         .set('Cookie', [`oauth_state=${state}`]);

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/auth/google/callback');

      const redirectUrl = new URL(res.headers.location, 'http://localhost');
      expect(redirectUrl.searchParams.get('state')).toBe(state);
      expect(redirectUrl.searchParams.get('code')).toBeTruthy();
   });

   it('exchanges a valid unused code, sets auth cookies, and allows /api/users/me', async () => {
      const user = await createGoogleUser({ email: 'exchange-success@example.com' });
      const rawCode = crypto.randomBytes(32).toString('hex');
      const codeHash = crypto.createHmac('sha256', HMAC_SECRET).update(rawCode).digest('hex');
      await OAuthExchangeCode.create({ codeHash, userId: user._id, expiresAt: new Date(Date.now() + 60000) });

      const res = await request(app)
         .post('/api/auth/oauth/exchange')
         .send({ code: rawCode });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.headers['set-cookie']).toBeDefined();
      expect(res.headers['set-cookie'].some((cookie) => cookie.startsWith('accessToken='))).toBe(true);
      expect(res.headers['set-cookie'].some((cookie) => cookie.startsWith('refreshToken='))).toBe(true);

      const meRes = await request(app)
         .get('/api/users/me')
         .set('Cookie', res.headers['set-cookie']);

      expect(meRes.status).toBe(200);
      expect(meRes.body.user).toBeDefined();
      expect(meRes.body.user.email).toBe('exchange-success@example.com');
   });

   it('rejects an already-used exchange code', async () => {
      const user = await createGoogleUser({ email: 'used-code@example.com' });
      const rawCode = crypto.randomBytes(32).toString('hex');
      const codeHash = crypto.createHmac('sha256', HMAC_SECRET).update(rawCode).digest('hex');
      await OAuthExchangeCode.create({ codeHash, userId: user._id, expiresAt: new Date(Date.now() + 60000), used: true });

      const res = await request(app)
         .post('/api/auth/oauth/exchange')
         .send({ code: rawCode });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid or expired OAuth exchange code');
   });

   it('rejects an expired exchange code', async () => {
      const user = await createGoogleUser({ email: 'expired-code@example.com' });
      const rawCode = await makeExpiredCode('expired-code-123', user._id);

      const res = await request(app)
         .post('/api/auth/oauth/exchange')
         .send({ code: rawCode });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid or expired OAuth exchange code');
   });

   it('rejects an invalid/garbage exchange code cleanly', async () => {
      const res = await request(app)
         .post('/api/auth/oauth/exchange')
         .send({ code: 'this-is-not-a-real-code' });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid or expired OAuth exchange code');
   });
});
