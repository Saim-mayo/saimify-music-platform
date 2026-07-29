const request = require('supertest');
const mongoose = require('mongoose');
const { connect, closeDatabase, clearDatabase } = require('./testDb');
const { createAuthedUser } = require('./testAuth');

let app;
let Music;
let Playlist;

beforeAll(async () => {
   await connect();
   app = require('../src/app');
   Music = require('../src/models/music.model');
   Playlist = require('../src/models/playlist.model');
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

describe('POST /api/playlists (create)', () => {
   it('rejects unauthenticated requests', async () => {
      const res = await request(app).post('/api/playlists').send({ title: 'My Mix' });
      expect(res.status).toBe(401);
   });

   it('rejects a missing title', async () => {
      const { cookie } = await createAuthedUser();
      const res = await request(app).post('/api/playlists').set('Cookie', [cookie]).send({});
      expect(res.status).toBe(400);
   });

   it('creates a playlist', async () => {
      const { cookie } = await createAuthedUser();
      const res = await request(app)
         .post('/api/playlists')
         .set('Cookie', [cookie])
         .send({ title: 'My Mix', isPublic: false });

      expect(res.status).toBe(201);
      expect(res.body.playlist.title).toBe('My Mix');
      expect(res.body.playlist.isPublic).toBe(false);
      expect(res.body.playlist.songs).toEqual([]);
   });

   it('rejects a duplicate title for the same user', async () => {
      const { cookie } = await createAuthedUser();
      await request(app).post('/api/playlists').set('Cookie', [cookie]).send({ title: 'My Mix' });

      const res = await request(app).post('/api/playlists').set('Cookie', [cookie]).send({ title: 'My Mix' });
      expect(res.status).toBe(409);
   });

   it('allows two different users to use the same title', async () => {
      const { cookie: cookieA } = await createAuthedUser();
      const { cookie: cookieB } = await createAuthedUser();

      await request(app).post('/api/playlists').set('Cookie', [cookieA]).send({ title: 'Chill' });
      const res = await request(app).post('/api/playlists').set('Cookie', [cookieB]).send({ title: 'Chill' });

      expect(res.status).toBe(201);
   });
});

describe('POST /api/playlists/add-song', () => {
   it('rejects unauthenticated requests', async () => {
      const res = await request(app)
         .post('/api/playlists/add-song')
         .send({
            playlistId: new mongoose.Types.ObjectId().toString(),
            songId: new mongoose.Types.ObjectId().toString()
         });
      expect(res.status).toBe(401);
   });

   it('rejects malformed ids', async () => {
      const { cookie } = await createAuthedUser();
      const res = await request(app)
         .post('/api/playlists/add-song')
         .set('Cookie', [cookie])
         .send({ playlistId: 'bad-id', songId: 'also-bad' });
      expect(res.status).toBe(400);
   });

   it('returns 404 for a playlist that does not exist', async () => {
      const { cookie, user } = await createAuthedUser();
      const song = await createSong(user._id);

      const res = await request(app)
         .post('/api/playlists/add-song')
         .set('Cookie', [cookie])
         .send({ playlistId: new mongoose.Types.ObjectId().toString(), songId: song._id.toString() });
      expect(res.status).toBe(404);
   });

   it("returns 403 when adding to another user's playlist", async () => {
      const { user: owner } = await createAuthedUser();
      const { cookie: intruderCookie } = await createAuthedUser();
      const song = await createSong(owner._id);
      const playlist = await Playlist.create({ title: 'Owner Mix', user: owner._id });

      const res = await request(app)
         .post('/api/playlists/add-song')
         .set('Cookie', [intruderCookie])
         .send({ playlistId: playlist._id.toString(), songId: song._id.toString() });
      expect(res.status).toBe(403);
   });

   it('adds a song to the playlist', async () => {
      const { cookie, user } = await createAuthedUser();
      const song = await createSong(user._id);
      const playlist = await Playlist.create({ title: 'My Mix', user: user._id });

      const res = await request(app)
         .post('/api/playlists/add-song')
         .set('Cookie', [cookie])
         .send({ playlistId: playlist._id.toString(), songId: song._id.toString() });

      expect(res.status).toBe(200);
      expect(res.body.playlist.songs).toHaveLength(1);
      expect(res.body.playlist.songs[0].title).toBe('Test Song');
   });

   it('rejects adding the same song twice', async () => {
      const { cookie, user } = await createAuthedUser();
      const song = await createSong(user._id);
      const playlist = await Playlist.create({ title: 'My Mix', user: user._id, songs: [song._id] });

      const res = await request(app)
         .post('/api/playlists/add-song')
         .set('Cookie', [cookie])
         .send({ playlistId: playlist._id.toString(), songId: song._id.toString() });
      expect(res.status).toBe(409);
   });
});

describe('POST /api/playlists/remove-song', () => {
   it('rejects removing a song that is not in the playlist', async () => {
      const { cookie, user } = await createAuthedUser();
      const song = await createSong(user._id);
      const playlist = await Playlist.create({ title: 'My Mix', user: user._id });

      const res = await request(app)
         .post('/api/playlists/remove-song')
         .set('Cookie', [cookie])
         .send({ playlistId: playlist._id.toString(), songId: song._id.toString() });
      expect(res.status).toBe(409);
   });

   it('removes a song from the playlist', async () => {
      const { cookie, user } = await createAuthedUser();
      const song = await createSong(user._id);
      const playlist = await Playlist.create({ title: 'My Mix', user: user._id, songs: [song._id] });

      const res = await request(app)
         .post('/api/playlists/remove-song')
         .set('Cookie', [cookie])
         .send({ playlistId: playlist._id.toString(), songId: song._id.toString() });

      expect(res.status).toBe(200);
      expect(res.body.playlist.songs).toHaveLength(0);
   });

   it("returns 403 when removing from another user's playlist", async () => {
      const { user: owner } = await createAuthedUser();
      const { cookie: intruderCookie } = await createAuthedUser();
      const song = await createSong(owner._id);
      const playlist = await Playlist.create({ title: 'Owner Mix', user: owner._id, songs: [song._id] });

      const res = await request(app)
         .post('/api/playlists/remove-song')
         .set('Cookie', [intruderCookie])
         .send({ playlistId: playlist._id.toString(), songId: song._id.toString() });
      expect(res.status).toBe(403);
   });
});

describe('GET /api/playlists/user', () => {
   it('rejects unauthenticated requests', async () => {
      const res = await request(app).get('/api/playlists/user');
      expect(res.status).toBe(401);
   });

   it("only returns the caller's own playlists", async () => {
      const { cookie: cookieA, user: userA } = await createAuthedUser();
      const { user: userB } = await createAuthedUser();

      await Playlist.create({ title: 'Mine', user: userA._id });
      await Playlist.create({ title: 'Theirs', user: userB._id });

      const res = await request(app).get('/api/playlists/user').set('Cookie', [cookieA]);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.playlists[0].title).toBe('Mine');
   });
});

describe('GET /api/playlists/:playlistId', () => {
   it('rejects a malformed playlistId', async () => {
      const { cookie } = await createAuthedUser();
      const res = await request(app).get('/api/playlists/not-a-valid-id').set('Cookie', [cookie]);
      expect(res.status).toBe(400);
   });

   it('returns 404 for a playlist that does not exist', async () => {
      const { cookie } = await createAuthedUser();
      const res = await request(app)
         .get(`/api/playlists/${new mongoose.Types.ObjectId().toString()}`)
         .set('Cookie', [cookie]);
      expect(res.status).toBe(404);
   });

   it('allows the owner to view a private playlist', async () => {
      const { cookie, user } = await createAuthedUser();
      const playlist = await Playlist.create({ title: 'Secret', user: user._id, isPublic: false });

      const res = await request(app).get(`/api/playlists/${playlist._id}`).set('Cookie', [cookie]);
      expect(res.status).toBe(200);
      expect(res.body.playlist.title).toBe('Secret');
   });

   it('blocks a non-owner from viewing a private playlist', async () => {
      const { user: owner } = await createAuthedUser();
      const { cookie: intruderCookie } = await createAuthedUser();
      const playlist = await Playlist.create({ title: 'Secret', user: owner._id, isPublic: false });

      const res = await request(app).get(`/api/playlists/${playlist._id}`).set('Cookie', [intruderCookie]);
      expect(res.status).toBe(403);
   });

   it('allows anyone to view a public playlist', async () => {
      const { user: owner } = await createAuthedUser();
      const { cookie: viewerCookie } = await createAuthedUser();
      const playlist = await Playlist.create({ title: 'Public Mix', user: owner._id, isPublic: true });

      const res = await request(app).get(`/api/playlists/${playlist._id}`).set('Cookie', [viewerCookie]);
      expect(res.status).toBe(200);
   });
});

describe('DELETE /api/playlists/:playlistId', () => {
   it('rejects unauthenticated requests', async () => {
      const res = await request(app).delete(`/api/playlists/${new mongoose.Types.ObjectId().toString()}`);
      expect(res.status).toBe(401);
   });

   it('returns 404 for a playlist that does not exist', async () => {
      const { cookie } = await createAuthedUser();
      const res = await request(app)
         .delete(`/api/playlists/${new mongoose.Types.ObjectId().toString()}`)
         .set('Cookie', [cookie]);
      expect(res.status).toBe(404);
   });

   it("returns 403 when deleting another user's playlist", async () => {
      const { user: owner } = await createAuthedUser();
      const { cookie: intruderCookie } = await createAuthedUser();
      const playlist = await Playlist.create({ title: 'Owner Mix', user: owner._id });

      const res = await request(app).delete(`/api/playlists/${playlist._id}`).set('Cookie', [intruderCookie]);
      expect(res.status).toBe(403);
   });

   it('deletes the playlist', async () => {
      const { cookie, user } = await createAuthedUser();
      const playlist = await Playlist.create({ title: 'My Mix', user: user._id });

      const res = await request(app).delete(`/api/playlists/${playlist._id}`).set('Cookie', [cookie]);
      expect(res.status).toBe(200);

      const stored = await Playlist.findById(playlist._id);
      expect(stored).toBeNull();
   });
});
