const request = require('supertest');
const mongoose = require('mongoose');
const { connect, closeDatabase, clearDatabase } = require('./testDb');
const { createAuthedUser } = require('./testAuth');

let app;
let Music;
let Queue;

beforeAll(async () => {
   await connect();
   app = require('../src/app');
   Music = require('../src/models/music.model');
   Queue = require('../src/models/queue.model');
});

afterEach(async () => {
   await clearDatabase();
});

afterAll(async () => {
   await closeDatabase();
});

const createSong = async (artistId, overrides = {}) =>
   Music.create({
      fileId: 'file_123',
      filePath: '/uploads/song.mp3',
      title: 'Test Song',
      artist: artistId,
      ...overrides
   });

describe('POST /api/queue/add', () => {
   it('rejects unauthenticated requests', async () => {
      const res = await request(app)
         .post('/api/queue/add')
         .send({ songId: new mongoose.Types.ObjectId().toString() });
      expect(res.status).toBe(401);
   });

   it('rejects a missing/malformed songId', async () => {
      const { cookie } = await createAuthedUser();
      const res = await request(app).post('/api/queue/add').set('Cookie', [cookie]).send({});
      expect(res.status).toBe(400);
   });

   it('returns 404 for a songId that does not exist', async () => {
      const { cookie } = await createAuthedUser();
      const res = await request(app)
         .post('/api/queue/add')
         .set('Cookie', [cookie])
         .send({ songId: new mongoose.Types.ObjectId().toString() });
      expect(res.status).toBe(404);
   });

   it('creates a queue and adds the song', async () => {
      const { cookie, user } = await createAuthedUser();
      const song = await createSong(user._id);

      const res = await request(app)
         .post('/api/queue/add')
         .set('Cookie', [cookie])
         .send({ songId: song._id.toString() });

      expect(res.status).toBe(200);
      expect(res.body.queue).toHaveLength(1);
   });

   it('does not duplicate a song already in the queue', async () => {
      const { cookie, user } = await createAuthedUser();
      const song = await createSong(user._id);

      await request(app).post('/api/queue/add').set('Cookie', [cookie]).send({ songId: song._id.toString() });
      const res = await request(app)
         .post('/api/queue/add')
         .set('Cookie', [cookie])
         .send({ songId: song._id.toString() });

      expect(res.status).toBe(200);
      expect(res.body.queue).toHaveLength(1);
   });
});

describe('POST /api/queue/shuffle', () => {
   it('rejects unauthenticated requests', async () => {
      const res = await request(app).post('/api/queue/shuffle').send({ shuffle: true });
      expect(res.status).toBe(401);
   });

   it('rejects a non-boolean shuffle value', async () => {
      const { cookie } = await createAuthedUser();
      const res = await request(app).post('/api/queue/shuffle').set('Cookie', [cookie]).send({});
      expect(res.status).toBe(400);
   });

   it('returns 404 when the user has no queue yet', async () => {
      const { cookie } = await createAuthedUser();
      const res = await request(app).post('/api/queue/shuffle').set('Cookie', [cookie]).send({ shuffle: true });
      expect(res.status).toBe(404);
   });

   it('toggles shuffle on an existing queue', async () => {
      const { cookie, user } = await createAuthedUser();
      const song = await createSong(user._id);
      await Queue.create({ user: user._id, queue: [song._id] });

      const res = await request(app).post('/api/queue/shuffle').set('Cookie', [cookie]).send({ shuffle: true });

      expect(res.status).toBe(200);
      expect(res.body.isShuffle).toBe(true);
   });
});

describe('POST /api/queue/repeat', () => {
   it('rejects unauthenticated requests', async () => {
      const res = await request(app).post('/api/queue/repeat').send({ repeatMode: 'all' });
      expect(res.status).toBe(401);
   });

   it('rejects an invalid repeatMode', async () => {
      const { cookie } = await createAuthedUser();
      const res = await request(app)
         .post('/api/queue/repeat')
         .set('Cookie', [cookie])
         .send({ repeatMode: 'sometimes' });
      expect(res.status).toBe(400);
   });

   it('returns 404 when the user has no queue yet', async () => {
      const { cookie } = await createAuthedUser();
      const res = await request(app).post('/api/queue/repeat').set('Cookie', [cookie]).send({ repeatMode: 'all' });
      expect(res.status).toBe(404);
   });

   it('sets the repeat mode on an existing queue', async () => {
      const { cookie, user } = await createAuthedUser();
      const song = await createSong(user._id);
      await Queue.create({ user: user._id, queue: [song._id] });

      const res = await request(app)
         .post('/api/queue/repeat')
         .set('Cookie', [cookie])
         .send({ repeatMode: 'all' });

      expect(res.status).toBe(200);
      expect(res.body.repeatMode).toBe('all');
   });
});

describe('GET /api/queue/current', () => {
   it('rejects unauthenticated requests', async () => {
      const res = await request(app).get('/api/queue/current');
      expect(res.status).toBe(401);
   });

   it('returns 404 when the queue is empty or missing', async () => {
      const { cookie } = await createAuthedUser();
      const res = await request(app).get('/api/queue/current').set('Cookie', [cookie]);
      expect(res.status).toBe(404);
   });

   it('returns the song at currentIndex', async () => {
      const { cookie, user } = await createAuthedUser();
      const songA = await createSong(user._id, { title: 'A' });
      const songB = await createSong(user._id, { title: 'B' });
      await Queue.create({ user: user._id, queue: [songA._id, songB._id], currentIndex: 1 });

      const res = await request(app).get('/api/queue/current').set('Cookie', [cookie]);

      expect(res.status).toBe(200);
      expect(res.body.currentIndex).toBe(1);
      expect(res.body.song.title).toBe('B');
   });
});

describe('POST /api/queue/next', () => {
   it('rejects unauthenticated requests', async () => {
      const res = await request(app).post('/api/queue/next');
      expect(res.status).toBe(401);
   });

   it('returns 404 when the queue is empty', async () => {
      const { cookie } = await createAuthedUser();
      const res = await request(app).post('/api/queue/next').set('Cookie', [cookie]);
      expect(res.status).toBe(404);
   });

   it('advances currentIndex by one', async () => {
      const { cookie, user } = await createAuthedUser();
      const songA = await createSong(user._id, { title: 'A' });
      const songB = await createSong(user._id, { title: 'B' });
      await Queue.create({ user: user._id, queue: [songA._id, songB._id], currentIndex: 0 });

      const res = await request(app).post('/api/queue/next').set('Cookie', [cookie]);

      expect(res.status).toBe(200);
      expect(res.body.currentIndex).toBe(1);
   });

   it('wraps to the start when repeatMode is "all" and at the last song', async () => {
      const { cookie, user } = await createAuthedUser();
      const songA = await createSong(user._id, { title: 'A' });
      const songB = await createSong(user._id, { title: 'B' });
      await Queue.create({
         user: user._id,
         queue: [songA._id, songB._id],
         currentIndex: 1,
         repeatMode: 'all'
      });

      const res = await request(app).post('/api/queue/next').set('Cookie', [cookie]);

      expect(res.status).toBe(200);
      expect(res.body.currentIndex).toBe(0);
   });

   it('stays on the same index when repeatMode is "one"', async () => {
      const { cookie, user } = await createAuthedUser();
      const song = await createSong(user._id);
      await Queue.create({ user: user._id, queue: [song._id], currentIndex: 0, repeatMode: 'one' });

      const res = await request(app).post('/api/queue/next').set('Cookie', [cookie]);

      expect(res.status).toBe(200);
      expect(res.body.currentIndex).toBe(0);
      expect(res.body.message).toMatch(/repeating/i);
   });
});

describe('POST /api/queue/prev', () => {
   it('rejects unauthenticated requests', async () => {
      const res = await request(app).post('/api/queue/prev');
      expect(res.status).toBe(401);
   });

   it('returns 404 when the queue is empty', async () => {
      const { cookie } = await createAuthedUser();
      const res = await request(app).post('/api/queue/prev').set('Cookie', [cookie]);
      expect(res.status).toBe(404);
   });

   it('moves currentIndex back by one', async () => {
      const { cookie, user } = await createAuthedUser();
      const songA = await createSong(user._id, { title: 'A' });
      const songB = await createSong(user._id, { title: 'B' });
      await Queue.create({ user: user._id, queue: [songA._id, songB._id], currentIndex: 1 });

      const res = await request(app).post('/api/queue/prev').set('Cookie', [cookie]);

      expect(res.status).toBe(200);
      expect(res.body.currentIndex).toBe(0);
   });

   it('does not go below index 0', async () => {
      const { cookie, user } = await createAuthedUser();
      const song = await createSong(user._id);
      await Queue.create({ user: user._id, queue: [song._id], currentIndex: 0 });

      const res = await request(app).post('/api/queue/prev').set('Cookie', [cookie]);

      expect(res.status).toBe(200);
      expect(res.body.currentIndex).toBe(0);
   });
});

describe('GET /api/queue/all', () => {
   it('rejects unauthenticated requests', async () => {
      const res = await request(app).get('/api/queue/all');
      expect(res.status).toBe(401);
   });

   it('returns 404 when the queue is empty', async () => {
      const { cookie } = await createAuthedUser();
      const res = await request(app).get('/api/queue/all').set('Cookie', [cookie]);
      expect(res.status).toBe(404);
   });

   it('returns all songs in the queue', async () => {
      const { cookie, user } = await createAuthedUser();
      const songA = await createSong(user._id, { title: 'A' });
      const songB = await createSong(user._id, { title: 'B' });
      await Queue.create({ user: user._id, queue: [songA._id, songB._id] });

      const res = await request(app).get('/api/queue/all').set('Cookie', [cookie]);

      expect(res.status).toBe(200);
      expect(res.body.queue).toHaveLength(2);
   });
});

describe('POST /api/queue/set', () => {
   it('rejects unauthenticated requests', async () => {
      const res = await request(app).post('/api/queue/set').send({ queue: [] });
      expect(res.status).toBe(401);
   });

   it('rejects a missing or invalid queue', async () => {
      const { cookie } = await createAuthedUser();
      const res = await request(app).post('/api/queue/set').set('Cookie', [cookie]).send({ queue: 'not-an-array' });
      expect(res.status).toBe(400);
   });

   it('rejects invalid song IDs in the queue', async () => {
      const { cookie } = await createAuthedUser();
      const res = await request(app)
         .post('/api/queue/set')
         .set('Cookie', [cookie])
         .send({ queue: [new mongoose.Types.ObjectId().toString(), 'invalid-id'] });
      expect(res.status).toBe(400);
   });

   it('sets a new queue and currentIndex', async () => {
      const { cookie, user } = await createAuthedUser();
      const songA = await createSong(user._id, { title: 'A' });
      const songB = await createSong(user._id, { title: 'B' });

      const res = await request(app)
         .post('/api/queue/set')
         .set('Cookie', [cookie])
         .send({ queue: [songA._id.toString(), songB._id.toString()], currentIndex: 1 });

      expect(res.status).toBe(200);
      expect(res.body.queue).toHaveLength(2);
      expect(res.body.currentIndex).toBe(1);
   });
});

describe('DELETE /api/queue/clear', () => {
   it('rejects unauthenticated requests', async () => {
      const res = await request(app).delete('/api/queue/clear');
      expect(res.status).toBe(401);
   });

   it('returns 404 when the user has no queue yet', async () => {
      const { cookie } = await createAuthedUser();
      const res = await request(app).delete('/api/queue/clear').set('Cookie', [cookie]);
      expect(res.status).toBe(404);
   });

   it('clears an existing queue back to defaults', async () => {
      const { cookie, user } = await createAuthedUser();
      const song = await createSong(user._id);
      await Queue.create({
         user: user._id,
         queue: [song._id],
         currentIndex: 0,
         isShuffle: true,
         repeatMode: 'all'
      });

      const res = await request(app).delete('/api/queue/clear').set('Cookie', [cookie]);
      expect(res.status).toBe(200);

      const stored = await Queue.findOne({ user: user._id });
      expect(stored.queue).toHaveLength(0);
      expect(stored.isShuffle).toBe(false);
      expect(stored.repeatMode).toBe('off');
   });
});
