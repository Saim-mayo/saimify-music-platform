const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('./testDb');

// email.service is mocked so no real SMTP call is ever attempted, and so
// the test can recover the raw reset token the same way a real user
// would receive it: via the emailed link.
//
// Both exports must be mocked: registerService -> issueVerificationEmail
// calls sendVerificationEmail on every registration. Leaving it out of
// this factory meant it was `undefined` at call time, which threw
// "sendVerificationEmail is not a function" and 500'd every /register
// call in this suite.
jest.mock('../src/services/email.service', () => ({
   sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
   sendVerificationEmail: jest.fn().mockResolvedValue(undefined)
}));
const { sendPasswordResetEmail, sendVerificationEmail } = require('../src/services/email.service');

let app;
let User;

beforeAll(async () => {
   await connect();
   app = require('../src/app');
   User = require('../src/models/user.model');
});

afterEach(async () => {
   await clearDatabase();
   sendPasswordResetEmail.mockClear();
   sendVerificationEmail.mockClear();
});

afterAll(async () => {
   await closeDatabase();
});

const register = (overrides = {}) =>
   request(app)
      .post('/api/auth/register')
      .send({
         username: 'testuser',
         email: 'test@example.com',
         password: 'password123',
         ...overrides
      });

const login = (overrides = {}) =>
   request(app)
      .post('/api/auth/login')
      .send({
         email: 'test@example.com',
         password: 'password123',
         ...overrides
      });

// loginService rejects unverified local accounts with 403 (see
// auth.service.js). Verification itself is exercised by hitting
// /auth/verify-email in a dedicated test elsewhere; here we just need an
// already-verified user so login/refresh/logout flows can be tested
// without re-deriving the token every time.
const verifyEmail = (email = 'test@example.com') =>
   User.findOneAndUpdate({ email }, { isEmailVerified: true });

describe('POST /api/auth/register', () => {
   it('registers a new user and never leaks password/hash', async () => {
      const res = await register();

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.user.email).toBe('test@example.com');
      expect(res.body.user.role).toBe('user');
      expect(res.body.user.password).toBeUndefined();
   });

   it('rejects duplicate email', async () => {
      await register();
      const res = await register({ username: 'anotherUser' });

      expect(res.status).toBe(409);
   });

   it('rejects a password shorter than 8 characters', async () => {
      const res = await register({ password: 'short' });
      expect(res.status).toBe(400);
   });

   it('ignores a client-supplied role (privilege escalation guard)', async () => {
      const res = await register({ role: 'admin' });

      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe('user');
   });
});

describe('POST /api/auth/login', () => {
   beforeEach(async () => {
      await register();
      await verifyEmail();
   });

   it('allows an admin account to log in even before email verification is completed', async () => {
      const password = 'password123';
      const hashedPassword = require('bcrypt').hashSync(password, 12);

      await User.create({
         username: 'adminuser',
         email: 'admin@example.com',
         password: hashedPassword,
         role: 'admin',
         isEmailVerified: false
      });

      const res = await request(app)
         .post('/api/auth/login')
         .send({ email: 'admin@example.com', password });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
   });

   it('logs in with correct credentials and issues tokens', async () => {
      const res = await login();

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.headers['set-cookie']).toBeDefined();
   });

   it('rejects an incorrect password', async () => {
      const res = await login({ password: 'wrongpassword' });
      expect(res.status).toBe(401);
   });

   it('rejects an unknown email', async () => {
      const res = await login({ email: 'nobody@example.com' });
      expect(res.status).toBe(401);
   });
});

describe('Email verification', () => {
   it('rejects login for a freshly registered, unverified account', async () => {
      await register();
      const res = await login();
      expect(res.status).toBe(403);
   });

   it('verifies via the emailed token, then login succeeds', async () => {
      await register();

      const [, verifyUrl] = sendVerificationEmail.mock.calls[0];
      const token = new URL(verifyUrl).searchParams.get('token');
      expect(token).toBeTruthy();

      const verifyRes = await request(app)
         .post('/api/auth/verify-email')
         .send({ token });
      expect(verifyRes.status).toBe(200);

      const res = await login();
      expect(res.status).toBe(200);
   });

   it('rejects an invalid verification token', async () => {
      const res = await request(app)
         .post('/api/auth/verify-email')
         .send({ token: 'not-a-real-token' });
      expect(res.status).toBe(400);
   });
});

describe('Refresh token rotation', () => {
   it('rotates the refresh token and rejects reuse of the old one', async () => {
      await register();
      await verifyEmail();
      const loginRes = await login();
      const oldRefreshToken = loginRes.body.refreshToken;

      const refreshRes = await request(app)
         .post('/api/auth/refresh-token')
         .send({ refreshToken: oldRefreshToken });

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.refreshToken).toBeDefined();
      expect(refreshRes.body.refreshToken).not.toBe(oldRefreshToken);

      // Replaying an already-rotated token is a reuse/theft signal and
      // must be rejected (see utils/tokenStore.js TOKEN_REUSE handling).
      const replayRes = await request(app)
         .post('/api/auth/refresh-token')
         .send({ refreshToken: oldRefreshToken });

      expect(replayRes.status).toBe(403);
   });

   it('rejects a refresh request with no token at all', async () => {
      const res = await request(app).post('/api/auth/refresh-token').send({});
      expect(res.status).toBe(401);
   });
});

describe('POST /api/auth/logout', () => {
   it('clears cookies and revokes the refresh token', async () => {
      await register();
      await verifyEmail();
      const loginRes = await login();
      const refreshToken = loginRes.body.refreshToken;

      const logoutRes = await request(app)
         .post('/api/auth/logout')
         .send({ refreshToken });

      expect(logoutRes.status).toBe(200);

      const refreshRes = await request(app)
         .post('/api/auth/refresh-token')
         .send({ refreshToken });

      expect(refreshRes.status).toBe(401);
   });
});

describe('Password reset flow', () => {
   it('does not reveal whether an email exists', async () => {
      const res = await request(app)
         .post('/api/auth/forgot-password')
         .send({ email: 'doesnotexist@example.com' });

      expect(res.status).toBe(200);
      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
   });

   it('completes forgot -> reset -> old password rejected, new one works', async () => {
      await register();
      await verifyEmail();

      const forgotRes = await request(app)
         .post('/api/auth/forgot-password')
         .send({ email: 'test@example.com' });

      expect(forgotRes.status).toBe(200);
      expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);

      // Recover the raw token the same way the user would: from the
      // link that was "emailed" (captured by the mock above). Only its
      // hash is ever stored in Mongo.
      const [, resetUrl] = sendPasswordResetEmail.mock.calls[0];
      const resetToken = new URL(resetUrl).searchParams.get('token');
      expect(resetToken).toBeTruthy();

      const dbUser = await User.findOne({ email: 'test@example.com' }).select(
         '+passwordResetTokenHash'
      );
      expect(dbUser.passwordResetTokenHash).toBeTruthy();

      const resetRes = await request(app)
         .post('/api/auth/reset-password')
         .send({ token: resetToken, password: 'newpassword456' });

      expect(resetRes.status).toBe(200);

      const oldLoginRes = await login({ password: 'password123' });
      expect(oldLoginRes.status).toBe(401);

      const newLoginRes = await login({ password: 'newpassword456' });
      expect(newLoginRes.status).toBe(200);
   });

   it('rejects an invalid or already-used token', async () => {
      const res = await request(app)
         .post('/api/auth/reset-password')
         .send({ token: 'not-a-real-token', password: 'whatever123' });

      expect(res.status).toBe(400);
   });

   it('rejects a reset password shorter than 8 characters', async () => {
      const res = await request(app)
         .post('/api/auth/reset-password')
         .send({ token: 'irrelevant', password: 'short' });

      expect(res.status).toBe(400);
   });
});
