const request = require('supertest');
const { Readable } = require('stream');
const { connect, closeDatabase, clearDatabase } = require('./testDb');
const { createAuthedUser } = require('./testAuth');
const Music = require('../src/models/music.model');
const History = require('../src/models/history.model');
const Download = require('../src/models/download.model');
const DownloadLog = require('../src/models/downloadLog.model');
const Album = require('../src/models/album.model');
const Plan = require('../src/models/plan.model');
const { loadPlanCache } = require('../src/services/planCache.service');

jest.mock('axios', () => {
   const axios = jest.fn();
   axios.head = jest.fn();
   return axios;
});

jest.mock('../src/services/storage.service', () => ({
   getInternalFileUrl: jest.fn(() => 'https://ik.imagekit.io/test/song.mp3')
}));

const axios = require('axios');

let app;

const seedPlan = async () => {
   await Plan.create({
      planKey: 'pro',
      name: 'Pro',
      level: 1,
      stripeProductId: 'prod_test_pro',
      prices: [
         {
            stripePriceId: 'price_test_pro_monthly',
            interval: 'monthly',
            amount: 999,
            currency: 'usd',
            active: true
         }
      ],
      features: {
         dailyPlayLimit: null,
         canDownload: true,
         maxDownloads: 10,
         adFree: true
      },
      isActive: true
   });

   await loadPlanCache();
};

const createSong = async (artistId, overrides = {}) =>
   Music.create({
      fileId: 'file_123',
      filePath: '/test/song.mp3',
      fileSize: 1024,
      title: 'Test Song',
      artist: artistId,
      status: 'active',
      visibility: 'public',
      premiumOnly: false,
      allowDownload: true,
      processingFinished: true,
      ...overrides
   });

const createPremiumSong = async (artistId, overrides = {}) =>
   createSong(artistId, {
      title: 'Premium Track',
      premiumOnly: true,
      ...overrides
   });

const createAlbum = async (artistId, musicIds, overrides = {}) =>
   Album.create({
      title: 'Test Album',
      artist: artistId,
      musics: musicIds,
      status: 'active',
      ...overrides
   });

beforeAll(async () => {
   await connect();
   app = require('../src/app');
});

afterEach(async () => {
   await clearDatabase();
   jest.clearAllMocks();
});

afterAll(async () => {
   await closeDatabase();
});

describe('Music API - Phase 5', () => {
   it('lists only active public songs', async () => {
      const { user } = await createAuthedUser();
      await createSong(user._id, { title: 'Public One' });
      await createSong(user._id, { title: 'Public Two' });
      await createSong(user._id, { title: 'Private Track', visibility: 'private' });

      const res = await request(app).get('/api/music/all-songs');

      expect(res.status).toBe(200);
      expect(res.body.songs.songs).toHaveLength(2);
      expect(res.body.songs.songs.map((song) => song.title)).toEqual(
         expect.arrayContaining(['Public One', 'Public Two'])
      );
   });

   it('searches songs by title and rejects empty queries', async () => {
      const { user } = await createAuthedUser();
      await createSong(user._id, { title: 'My Song' });
      await createSong(user._id, { title: 'Other Title' });

      const missingRes = await request(app).get('/api/music/search/songs');
      expect(missingRes.status).toBe(400);

      const res = await request(app).get('/api/music/search/songs').query({ q: 'my' });
      expect(res.status).toBe(200);
      expect(res.body.results).toHaveLength(1);
      expect(res.body.results[0].title).toBe('My Song');
   });

   it('returns trending songs sorted by playCount', async () => {
      const { user } = await createAuthedUser();
      await createSong(user._id, { title: 'Low Play', playCount: 1 });
      await createSong(user._id, { title: 'High Play', playCount: 10 });

      const res = await request(app).get('/api/music/trending');

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);
      expect(res.body.songs[0].title).toBe('High Play');
      expect(res.body.songs[1].title).toBe('Low Play');
   });

   it('increments play count and records history', async () => {
      const { cookie, user } = await createAuthedUser();
      const song = await createSong(user._id);

      const res = await request(app)
         .post(`/api/music/play/${song._id}`)
         .set('Cookie', [cookie]);

      expect(res.status).toBe(200);
      expect(res.body.playCount).toBe(1);

      const history = await History.findOne({ user: user._id, song: song._id });
      expect(history).toBeTruthy();
   });

   it('streams an audio range successfully for a public song', async () => {
      const { cookie, user } = await createAuthedUser();
      const song = await createSong(user._id);
      const streamData = Readable.from([Buffer.alloc(500)]);

      axios.mockResolvedValueOnce({ data: streamData });

      const res = await request(app)
         .get(`/api/music/stream/${song._id}`)
         .set('Cookie', [cookie])
         .set('Range', 'bytes=0-499');

      expect(res.status).toBe(206);
      expect(res.headers['content-type']).toBe('audio/mpeg');
      expect(res.headers['content-range']).toMatch(/^bytes 0-499\/1024$/);
   });

   it('blocks streaming for a premium-only song on a free account', async () => {
      const { cookie, user } = await createAuthedUser();
      const song = await createPremiumSong(user._id);

      const res = await request(app)
         .get(`/api/music/stream/${song._id}`)
         .set('Cookie', [cookie])
         .set('Range', 'bytes=0-499');

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/paid plan is required/i);
   });

   it('downloads a song for a paid user and records the download', async () => {
      await seedPlan();
      const { cookie, user } = await createAuthedUser({
         subscription: {
            plan: 'pro',
            billingInterval: 'monthly',
            status: 'active',
            stripeCustomerId: 'cus_test',
            stripeSubscriptionId: 'sub_test'
         }
      });

      const song = await createSong(user._id);
      const streamData = Readable.from([Buffer.alloc(16)]);
      axios.mockResolvedValueOnce({ headers: { 'content-length': '16' }, data: streamData });

      const res = await request(app)
         .get(`/api/music/download/${song._id}`)
         .set('Cookie', [cookie])
         .set('User-Agent', 'jest-test');

      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toMatch(/attachment/);

      const download = await Download.findOne({ user: user._id, song: song._id });
      expect(download).toBeTruthy();
      expect(download.downloadCount).toBe(1);

      const log = await DownloadLog.findOne({ user: user._id, song: song._id });
      expect(log).toBeTruthy();
      expect(log.userAgent).toBe('jest-test');
   });

   it('returns the user play history', async () => {
      const { cookie, user } = await createAuthedUser();
      const song = await createSong(user._id);

      await request(app)
         .post(`/api/music/play/${song._id}`)
         .set('Cookie', [cookie]);

      const res = await request(app)
         .get('/api/music/history')
         .set('Cookie', [cookie]);

      expect(res.status).toBe(200);
      expect(res.body.history).toHaveLength(1);
      expect(res.body.history[0].song.title).toBe('Test Song');
   });

   it('returns only the authenticated artist songs', async () => {
      const { cookie, user } = await createAuthedUser({
         role: 'artist',
         artistVerification: { status: 'approved', isVerified: true }
      });
      const otherUserResult = await createAuthedUser({ role: 'artist', artistVerification: { status: 'approved', isVerified: true } });
      const otherUser = otherUserResult.user;
      await createSong(user._id, { title: 'My Artist Track' });
      await createSong(otherUser._id, { title: 'Other Artist Track' });

      const res = await request(app)
         .get('/api/music/my-songs')
         .set('Cookie', [cookie]);

      expect(res.status).toBe(200);
      expect(res.body.songs).toHaveLength(1);
      expect(res.body.songs[0].title).toBe('My Artist Track');
      expect(res.body.pagination.totalItems).toBe(1);
   });

   it('returns only the authenticated artist albums', async () => {
      const { cookie, user } = await createAuthedUser({
         role: 'artist',
         artistVerification: { status: 'approved', isVerified: true }
      });
      const otherUserResult = await createAuthedUser({ role: 'artist', artistVerification: { status: 'approved', isVerified: true } });
      const otherUser = otherUserResult.user;
      const mySong = await createSong(user._id);
      const otherSong = await createSong(otherUser._id);
      await createAlbum(user._id, [mySong._id]);
      await createAlbum(otherUser._id, [otherSong._id], { title: 'Other Album' });

      const res = await request(app)
         .get('/api/music/my-albums')
         .set('Cookie', [cookie]);

      expect(res.status).toBe(200);
      expect(res.body.albums).toHaveLength(1);
      expect(res.body.albums[0].artist._id.toString()).toBe(user._id.toString());
      expect(res.body.pagination.totalItems).toBe(1);
   });
});

