const request = require('supertest');
const mongoose = require('mongoose');
const { connect, closeDatabase, clearDatabase } = require('./testDb');
const { createAuthedUser } = require('./testAuth');

let app;
let Music;
let Like;

beforeAll(async () => {
   await connect();
   app = require('../src/app');
   Music = require('../src/models/music.model');
   Like = require('../src/models/like.model');
});

afterEach(async () => {
   await clearDatabase();
});

afterAll(async () => {
   await closeDatabase();
});

// Songs need an `artist` (User ref); reuse the authed user for that so we
// don't have to create a second throwaway user per test.
const createSong = async (artistId, overrides = {}) =>
   Music.create({
      fileId: 'file_123',
      filePath: '/uploads/song.mp3',
      title: 'Test Song',
      artist: artistId,
      ...overrides
   });

describe('POST /api/likes/like', () => {
   it('rejects unauthenticated requests', async () => {
      const res = await request(app)
         .post('/api/likes/like')
         .send({ songId: new mongoose.Types.ObjectId().toString() });

      expect(res.status).toBe(401);
   });

   it('rejects a malformed songId', async () => {
      const { cookie } = await createAuthedUser();

      const res = await request(app)
         .post('/api/likes/like')
         .set('Cookie', [cookie])
         .send({ songId: 'not-a-valid-id' });

      expect(res.status).toBe(400);
   });

   it('returns 404 for a songId that does not exist', async () => {
      const { cookie } = await createAuthedUser();

      const res = await request(app)
         .post('/api/likes/like')
         .set('Cookie', [cookie])
         .send({ songId: new mongoose.Types.ObjectId().toString() });

      expect(res.status).toBe(404);
   });

   it('likes a song and persists it', async () => {
      const { cookie, user } = await createAuthedUser();
      const song = await createSong(user._id);

      const res = await request(app)
         .post('/api/likes/like')
         .set('Cookie', [cookie])
         .send({ songId: song._id.toString() });

      expect(res.status).toBe(201);
      expect(res.body.like).toBeDefined();

      const stored = await Like.findOne({ user: user._id, song: song._id });
      expect(stored).toBeTruthy();
   });

   it('rejects liking the same song twice', async () => {
      const { cookie, user } = await createAuthedUser();
      const song = await createSong(user._id);

      await request(app).post('/api/likes/like').set('Cookie', [cookie]).send({ songId: song._id.toString() });
      const res = await request(app)
         .post('/api/likes/like')
         .set('Cookie', [cookie])
         .send({ songId: song._id.toString() });

      expect(res.status).toBe(409);
   });
});

describe('POST /api/likes/unlike', () => {
   it('rejects unauthenticated requests', async () => {
      const res = await request(app)
         .post('/api/likes/unlike')
         .send({ songId: new mongoose.Types.ObjectId().toString() });

      expect(res.status).toBe(401);
   });

   it('returns 404 for a songId that does not exist', async () => {
      const { cookie } = await createAuthedUser();

      const res = await request(app)
         .post('/api/likes/unlike')
         .set('Cookie', [cookie])
         .send({ songId: new mongoose.Types.ObjectId().toString() });

      expect(res.status).toBe(404);
   });

   it('rejects unliking a song that was never liked', async () => {
      const { cookie, user } = await createAuthedUser();
      const song = await createSong(user._id);

      const res = await request(app)
         .post('/api/likes/unlike')
         .set('Cookie', [cookie])
         .send({ songId: song._id.toString() });

      expect(res.status).toBe(409);
   });

   it('unlikes a previously liked song', async () => {
      const { cookie, user } = await createAuthedUser();
      const song = await createSong(user._id);

      await request(app).post('/api/likes/like').set('Cookie', [cookie]).send({ songId: song._id.toString() });

      const res = await request(app)
         .post('/api/likes/unlike')
         .set('Cookie', [cookie])
         .send({ songId: song._id.toString() });

      expect(res.status).toBe(200);

      const stored = await Like.findOne({ user: user._id, song: song._id });
      expect(stored).toBeNull();
   });
});

describe('GET /api/likes/likes/:songId', () => {
   it('rejects unauthenticated requests', async () => {
      const res = await request(app).get(
         `/api/likes/likes/${new mongoose.Types.ObjectId().toString()}`
      );

      expect(res.status).toBe(401);
   });

   it('rejects a malformed songId', async () => {
      const { cookie } = await createAuthedUser();

      const res = await request(app)
         .get('/api/likes/likes/not-a-valid-id')
         .set('Cookie', [cookie]);

      expect(res.status).toBe(400);
   });

   it('returns 404 for a songId that does not exist', async () => {
      const { cookie } = await createAuthedUser();

      const res = await request(app)
         .get(`/api/likes/likes/${new mongoose.Types.ObjectId().toString()}`)
         .set('Cookie', [cookie]);

      expect(res.status).toBe(404);
   });

   it('reports zero likes for a song nobody has liked', async () => {
      const { cookie, user } = await createAuthedUser();
      const song = await createSong(user._id);

      const res = await request(app)
         .get(`/api/likes/likes/${song._id.toString()}`)
         .set('Cookie', [cookie]);

      expect(res.status).toBe(200);
      expect(res.body.totalLikes).toBe(0);
      expect(res.body.hasLikes).toBe(false);
   });

   it('reflects an accurate like count', async () => {
      const { cookie: cookieA, user: userA } = await createAuthedUser();
      const { cookie: cookieB } = await createAuthedUser();
      const song = await createSong(userA._id);

      await request(app).post('/api/likes/like').set('Cookie', [cookieA]).send({ songId: song._id.toString() });
      await request(app).post('/api/likes/like').set('Cookie', [cookieB]).send({ songId: song._id.toString() });

      const res = await request(app)
         .get(`/api/likes/likes/${song._id.toString()}`)
         .set('Cookie', [cookieA]);

      expect(res.status).toBe(200);
      expect(res.body.totalLikes).toBe(2);
      expect(res.body.hasLikes).toBe(true);
   });
});
