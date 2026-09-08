const request = require('supertest');
const mongoose = require('mongoose');
const { connect, closeDatabase, clearDatabase } = require('./testDb');
const { createAuthedUser } = require('./testAuth');
const Notification = require('../src/models/notification.model');

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

const createNotification = (userId, overrides = {}) =>
   Notification.create({
      recipientId: userId,
      type: 'payment_success',
      title: 'Test notice',
      message: 'This is a test notification',
      ...overrides
   });

describe('Admin and notifications', () => {
   it('returns the pending artist list for an admin', async () => {
      const { cookie: adminCookie } = await createAuthedUser({ role: 'admin' });
      const { user } = await createAuthedUser({ username: 'artist_requester', email: 'artist@example.com' });

      await mongoose.model('User').findByIdAndUpdate(user._id, {
         'artistVerification.status': 'pending'
      });

      const res = await request(app)
         .get('/api/admin/artists/pending')
         .set('Cookie', [adminCookie]);

      expect(res.status).toBe(200);
      expect(res.body.artists).toHaveLength(1);
      expect(res.body.artists[0]._id).toBe(user._id.toString());
   });

   it('approves and rejects artist requests correctly', async () => {
      const { cookie: adminCookie } = await createAuthedUser({ role: 'admin' });

      const { user: approveCandidate } = await createAuthedUser({ username: 'approve_me', email: 'approve@example.com' });
      await mongoose.model('User').findByIdAndUpdate(approveCandidate._id, {
         'artistVerification.status': 'pending'
      });

      const approveRes = await request(app)
         .patch(`/api/admin/artists/${approveCandidate._id}/approve`)
         .set('Cookie', [adminCookie]);

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.success).toBe(true);

      const refreshedApprove = await mongoose.model('User').findById(approveCandidate._id);
      expect(refreshedApprove.role).toBe('artist');
      expect(refreshedApprove.artistVerification.status).toBe('approved');

      const { user: rejectCandidate } = await createAuthedUser({ username: 'reject_me', email: 'reject@example.com' });
      await mongoose.model('User').findByIdAndUpdate(rejectCandidate._id, {
         'artistVerification.status': 'pending'
      });

      const rejectRes = await request(app)
         .patch(`/api/admin/artists/${rejectCandidate._id}/reject`)
         .set('Cookie', [adminCookie]);

      expect(rejectRes.status).toBe(200);
      expect(rejectRes.body.success).toBe(true);

      const refreshedReject = await mongoose.model('User').findById(rejectCandidate._id);
      expect(refreshedReject.role).toBe('user');
      expect(refreshedReject.artistVerification.status).toBe('rejected');
   });

   it('bans and unbans a user with proper guard rails', async () => {
      const { cookie: adminCookie, user: adminUser } = await createAuthedUser({ role: 'admin' });
      const { user: normalUser } = await createAuthedUser({ username: 'bannable', email: 'bannable@example.com' });

      const banRes = await request(app)
         .patch(`/api/admin/users/${normalUser._id}/ban`)
         .set('Cookie', [adminCookie]);

      expect(banRes.status).toBe(200);
      expect(banRes.body.success).toBe(true);

      const bannedUser = await mongoose.model('User').findById(normalUser._id);
      expect(bannedUser.isBanned).toBe(true);

      const secondBanRes = await request(app)
         .patch(`/api/admin/users/${normalUser._id}/ban`)
         .set('Cookie', [adminCookie]);

      expect(secondBanRes.status).toBe(409);

      const unbanRes = await request(app)
         .patch(`/api/admin/users/${normalUser._id}/unban`)
         .set('Cookie', [adminCookie]);

      expect(unbanRes.status).toBe(200);
      expect(unbanRes.body.success).toBe(true);

      const unbannedUser = await mongoose.model('User').findById(normalUser._id);
      expect(unbannedUser.isBanned).toBe(false);

      const secondUnbanRes = await request(app)
         .patch(`/api/admin/users/${normalUser._id}/unban`)
         .set('Cookie', [adminCookie]);

      expect(secondUnbanRes.status).toBe(409);

      const selfBanRes = await request(app)
         .patch(`/api/admin/users/${adminUser._id}/ban`)
         .set('Cookie', [adminCookie]);

      expect(selfBanRes.status).toBe(400);
   });

   it('lists and marks notifications as read for a normal user', async () => {
      const { cookie, user } = await createAuthedUser({ username: 'notify', email: 'notify@example.com' });
      const personal = await createNotification(user._id);
      const global = await createNotification(null, { isGlobal: true, type: 'admin_announcement', title: 'Global', message: 'Global notice' });

      const listRes = await request(app)
         .get('/api/notifications')
         .set('Cookie', [cookie]);

      expect(listRes.status).toBe(200);
      expect(listRes.body.items).toHaveLength(2);
      expect(listRes.body.total).toBe(2);
      expect(listRes.body.items.some((item) => item._id === personal._id.toString())).toBe(true);
      expect(listRes.body.items.some((item) => item._id === global._id.toString())).toBe(true);

      const countRes = await request(app)
         .get('/api/notifications/unread-count')
         .set('Cookie', [cookie]);

      expect(countRes.status).toBe(200);
      expect(countRes.body.count).toBe(2);

      const markRes = await request(app)
         .patch(`/api/notifications/${personal._id}/read`)
         .set('Cookie', [cookie]);

      expect(markRes.status).toBe(200);
      expect(markRes.body.success).toBe(true);

      const afterMarkRes = await request(app)
         .get('/api/notifications/unread-count')
         .set('Cookie', [cookie]);

      expect(afterMarkRes.status).toBe(200);
      expect(afterMarkRes.body.count).toBe(1);

      const readAllRes = await request(app)
         .patch('/api/notifications/read-all')
         .set('Cookie', [cookie]);

      expect(readAllRes.status).toBe(200);
      expect(readAllRes.body.success).toBe(true);

      const finalCountRes = await request(app)
         .get('/api/notifications/unread-count')
         .set('Cookie', [cookie]);

      expect(finalCountRes.status).toBe(200);
      expect(finalCountRes.body.count).toBe(0);
   });

   it('allows an admin to broadcast an announcement to all users', async () => {
      const { cookie: adminCookie } = await createAuthedUser({ role: 'admin' });

      const res = await request(app)
         .post('/api/notifications/announce')
         .set('Cookie', [adminCookie])
         .send({ title: 'Hello', message: 'Platform announcement' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
   });
});
