const request = require('supertest');
const User = require('../src/models/user.model');
const { connect, closeDatabase, clearDatabase } = require('./testDb');
const { createAuthedUser } = require('./testAuth');

let app;

beforeAll(async () => {
   await connect();
   app = require('../src/app');
});

afterEach(async () => {
   await clearDatabase();
});

afterAll(async () => {
   await closeDatabase();
});

describe('Users API', () => {
   it('returns the current user profile without sensitive fields', async () => {
      const { cookie } = await createAuthedUser({ username: 'alice', email: 'alice@example.com' });

      const res = await request(app)
         .get('/api/users/me')
         .set('Cookie', [cookie]);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('alice@example.com');
      expect(res.body.user.username).toBe('alice');
      expect(res.body.user.password).toBeUndefined();
      expect(res.body.user.refreshToken).toBeUndefined();
   });

   it('updates the current user profile successfully', async () => {
      const { cookie } = await createAuthedUser({ username: 'bob', email: 'bob@example.com' });

      const res = await request(app)
         .patch('/api/users/me')
         .set('Cookie', [cookie])
         .send({ username: 'bob_new', bio: 'New bio' });

      expect(res.status).toBe(200);
      expect(res.body.updated.username).toBe('bob_new');
      expect(res.body.updated.bio).toBe('New bio');
   });

   it('rejects a duplicate username when updating profile', async () => {
      await createAuthedUser({ username: 'existing', email: 'existing@example.com' });
      const { cookie } = await createAuthedUser({ username: 'owner', email: 'owner@example.com' });

      const res = await request(app)
         .patch('/api/users/me')
         .set('Cookie', [cookie])
         .send({ username: 'existing' });

      expect(res.status).toBe(409);
   });

   it('returns feature flags for a free user', async () => {
      const { cookie } = await createAuthedUser({ username: 'charlie', email: 'charlie@example.com' });

      const res = await request(app)
         .get('/api/users/me/features')
         .set('Cookie', [cookie]);

      expect(res.status).toBe(200);
      expect(res.body.features).toHaveProperty('dailyPlayLimit');
      expect(res.body.features).toHaveProperty('canDownload');
      expect(res.body.features.canDownload).toBe(false);
   });

   it('submits an artist verification request and rejects duplicate requests', async () => {
      const { cookie, user } = await createAuthedUser({ username: 'dave', email: 'dave@example.com' });

      const first = await request(app)
         .post('/api/users/artist/request')
         .set('Cookie', [cookie]);

      expect(first.status).toBe(200);
      expect(first.body.message).toMatch(/Artist request submitted successfully/i);

      const second = await request(app)
         .post('/api/users/artist/request')
         .set('Cookie', [cookie]);

      expect(second.status).toBe(409);
      expect(second.body.message).toMatch(/already pending/i);

      const saved = await User.findById(user._id);
      expect(saved.artistVerification.status).toBe('pending');
   });

   it('allows a Google-only user to set a password once', async () => {
      const { cookie, user } = await createAuthedUser({
         username: 'googleuser',
         email: 'googleuser@example.com',
         googleId: 'google_123',
         provider: 'google',
         password: null
      });

      const res = await request(app)
         .patch('/api/users/set-password')
         .set('Cookie', [cookie])
         .send({ password: 'securePassword1' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const refreshed = await User.findById(user._id).select('+password');
      expect(refreshed.password).toBeDefined();
   });

   it('rejects password creation when a local password already exists', async () => {
      const { cookie } = await createAuthedUser({ username: 'localuser', email: 'localuser@example.com' });

      const res = await request(app)
         .patch('/api/users/set-password')
         .set('Cookie', [cookie])
         .send({ password: 'newPassword123' });

      expect(res.status).toBe(400);
   });
});
