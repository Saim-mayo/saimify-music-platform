const { Readable, Writable } = require('stream');

const mockCreateSongService = jest.fn();
const mockPlaySongService = jest.fn();
const mockSearchSongsService = jest.fn();
const mockMusicModelFind = jest.fn();
const mockSearchArtistsService = jest.fn();
const mockCreateAlbumService = jest.fn();
const mockGetAllSongsService = jest.fn();
const mockGetAllAlbumsService = jest.fn();
const mockGetAlbumByIdService = jest.fn();
const mockGetTrendingSongsService = jest.fn();
const mockGetUserHistoryService = jest.fn();
const mockGetInternalFileUrl = jest.fn(() => 'https://ik.imagekit.io/test/song.mp3');
const mockRecordDownload = jest.fn();
const mockGetUserDownloads = jest.fn();
const mockLoggerError = jest.fn();

jest.mock('../src/models/music.model', () => ({
   find: mockMusicModelFind
}));

jest.mock('../src/services/music.service', () => ({
   createSongService: mockCreateSongService,
   playSongService: mockPlaySongService,
   searchSongsService: mockSearchSongsService,
   searchArtistsService: mockSearchArtistsService,
   createAlbumService: mockCreateAlbumService,
   getAllSongsService: mockGetAllSongsService,
   getAllAlbumsService: mockGetAllAlbumsService,
   getAlbumByIdService: mockGetAlbumByIdService,
   getTrendingSongsService: mockGetTrendingSongsService,
   getUserHistoryService: mockGetUserHistoryService
}));

jest.mock('../src/services/storage.service', () => ({
   getInternalFileUrl: mockGetInternalFileUrl
}));

jest.mock('../src/services/download.service', () => ({
   recordDownload: mockRecordDownload,
   getUserDownloads: mockGetUserDownloads
}));

jest.mock('axios', () => {
   const axios = jest.fn();
   axios.head = jest.fn();
   return axios;
});

jest.mock('../src/config/env', () => ({
   IMAGE_KIT_URL_ENDPOINT: 'https://ik.imagekit.io'
}));

jest.mock('../src/config/logger', () => ({
   error: mockLoggerError
}));

const axios = require('axios');
const controller = require('../src/controllers/music.controller');

const flush = () => new Promise(resolve => setImmediate(resolve));

const createResponse = () => {
   const res = new Writable({
      write(chunk, encoding, callback) {
         callback();
      }
   });

   res.statusCode = 200;
   res.headers = {};
   res.body = undefined;
   res.status = jest.fn(function status(code) {
      this.statusCode = code;
      return this;
   });
   res.json = jest.fn(function json(payload) {
      this.body = payload;
      return this;
   });
   res.writeHead = jest.fn(function writeHead(code, headers) {
      this.statusCode = code;
      this.headers = headers;
      return this;
   });
   res.destroy = jest.fn();

   return res;
};

describe('music.controller', () => {
   beforeEach(() => {
      jest.clearAllMocks();
      mockGetInternalFileUrl.mockReturnValue('https://ik.imagekit.io/test/song.mp3');
      axios.head.mockResolvedValue({ headers: { 'content-length': '1024' } });
      axios.mockResolvedValue({ data: Readable.from([Buffer.from('abc')]), headers: { 'content-length': '3' } });
   });

   it('creates a song and passes the upload result through the response body', async () => {
      mockCreateSongService.mockResolvedValue({ _id: 'song_1' });
      const req = { files: { music: [{ buffer: Buffer.from('a'), originalname: 'song.mp3' }] }, body: { title: 'Song' }, user: { userId: 'u1' } };
      const res = createResponse();
      const next = jest.fn();

      controller.createSong(req, res, next);
      await flush();

      expect(mockCreateSongService).toHaveBeenCalledWith({ title: 'Song', file: req.files.music[0], userId: 'u1', cover: undefined });
      expect(res.statusCode).toBe(201);
      expect(res.body).toEqual({ message: 'Music created successfully', music: { _id: 'song_1' } });
   });

   it('plays a song and returns the updated play count', async () => {
      mockPlaySongService.mockResolvedValue({ playCount: 2 });
      const req = { params: { songId: 'song_1' }, user: { userId: 'u1' } };
      const res = createResponse();
      const next = jest.fn();

      controller.playSong(req, res, next);
      await flush();

      expect(mockPlaySongService).toHaveBeenCalledWith({ songId: 'song_1', userId: 'u1' });
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ message: 'Song played', playCount: 2 });
   });

   it('searches songs and artists with query validation and response totals', async () => {
      mockSearchSongsService.mockResolvedValue([{ title: 'Song' }]);
      mockSearchArtistsService.mockResolvedValue([{ username: 'Artist' }]);

      const songsReq = { query: { q: ' my ' }, user: { userId: 'u1' } };
      const songsRes = createResponse();
      controller.searchSongs(songsReq, songsRes, jest.fn());
      await flush();
      expect(mockSearchSongsService).toHaveBeenCalledWith('my');
      expect(songsRes.statusCode).toBe(200);
      expect(songsRes.body).toEqual({ total: 1, results: [{ title: 'Song' }] });

      const artistsReq = { query: { q: 'art' }, user: { userId: 'u1' } };
      const artistsRes = createResponse();
      controller.searchArtists(artistsReq, artistsRes, jest.fn());
      await flush();
      expect(mockSearchArtistsService).toHaveBeenCalledWith('art');
      expect(artistsRes.statusCode).toBe(200);
      expect(artistsRes.body).toEqual({ total: 1, results: [{ username: 'Artist' }] });
   });

   it('creates an album and returns the created payload', async () => {
      mockCreateAlbumService.mockResolvedValue({ _id: 'album_1' });
      const req = { body: { title: 'Album', musics: ['s1'] }, user: { userId: 'u1' } };
      const res = createResponse();

      controller.createAlbum(req, res, jest.fn());
      await flush();

      expect(mockCreateAlbumService).toHaveBeenCalledWith({ title: 'Album', musics: ['s1'], userId: 'u1', cover: undefined });
      expect(res.statusCode).toBe(201);
      expect(res.body).toEqual({ message: 'Album created successfully', album: { _id: 'album_1' } });
   });

   it('returns paginated songs and albums lists', async () => {
      mockGetAllSongsService.mockResolvedValue({ songs: [{ title: 'Song' }], pagination: { totalItems: 1, currentPage: 1, totalPages: 1 } });
      mockGetAllAlbumsService.mockResolvedValue({ albums: [{ title: 'Album' }], pagination: { totalItems: 1, currentPage: 1, totalPages: 1 } });

      const songsRes = createResponse();
      controller.getAllSongs({ query: { page: '1', limit: '10' } }, songsRes, jest.fn());
      await flush();
      expect(songsRes.statusCode).toBe(200);
      expect(songsRes.body).toEqual({ message: 'Songs fetched successfully', songs: { songs: [{ title: 'Song' }], pagination: { totalItems: 1, currentPage: 1, totalPages: 1 } } });

      const albumsRes = createResponse();
      controller.getAllAlbums({ query: { page: '2', limit: '5' } }, albumsRes, jest.fn());
      await flush();
      expect(albumsRes.statusCode).toBe(200);
      expect(albumsRes.body).toEqual({ message: 'Albums fetched successfully', albums: { albums: [{ title: 'Album' }], pagination: { totalItems: 1, currentPage: 1, totalPages: 1 } } });
   });

   it('returns an album by id and the trending/history endpoints', async () => {
      mockGetAlbumByIdService.mockResolvedValue({ title: 'Album' });
      mockGetTrendingSongsService.mockResolvedValue([{ title: 'Trending' }]);
      mockGetUserHistoryService.mockResolvedValue([{ title: 'History' }]);

      const albumRes = createResponse();
      controller.getAlbumById({ params: { albumId: 'album_1' } }, albumRes, jest.fn());
      await flush();
      expect(mockGetAlbumByIdService).toHaveBeenCalledWith('album_1');
      expect(albumRes.statusCode).toBe(200);
      expect(albumRes.body).toEqual({ message: 'Album fetched successfully', album: { title: 'Album' } });

      const trendingRes = createResponse();
      controller.getTrendingSongs({}, trendingRes, jest.fn());
      await flush();
      expect(trendingRes.statusCode).toBe(200);
      expect(trendingRes.body).toEqual({ total: 1, songs: [{ title: 'Trending' }] });

      const historyRes = createResponse();
      controller.getUserHistory({ user: { userId: 'u1' } }, historyRes, jest.fn());
      await flush();
      expect(mockGetUserHistoryService).toHaveBeenCalledWith('u1');
      expect(historyRes.statusCode).toBe(200);
      expect(historyRes.body).toEqual({ total: 1, history: [{ title: 'History' }] });
   });

   it('normalizes artist songs by removing placeholder titles and obvious duplicates', async () => {
      const chain = {
         populate: jest.fn().mockReturnThis(),
         sort: jest.fn().mockReturnThis(),
         limit: jest.fn().mockReturnThis(),
         lean: jest.fn().mockResolvedValue([
            { _id: 's1', title: 'song', artist: { _id: 'a1', username: 'Artist One' } },
            { _id: 's2', title: 'Astronaut In The Ocean (Lyrics) - Masked Wolf', artist: { _id: 'a1', username: 'Artist One' } },
            { _id: 's3', title: 'Astronaut In The Ocean (Lyrics)  Masked Wolf', artist: { _id: 'a1', username: 'Artist One' } },
            { _id: 's4', title: 'Real Track', artist: 'a1' }
         ])
      };
      mockMusicModelFind.mockReturnValue(chain);

      const req = { params: { artistId: 'a1' } };
      const res = createResponse();

      await controller.getSongsByArtist(req, res, jest.fn());

      expect(res.statusCode).toBe(200);
      expect(res.body.songs).toEqual([
         expect.objectContaining({ _id: 's2', title: 'Astronaut In The Ocean (Lyrics) - Masked Wolf', artistName: 'Artist One' }),
         expect.objectContaining({ _id: 's4', title: 'Real Track', artistName: 'Unknown artist' })
      ]);
   });

   it('records download history and streams the downloadable file', async () => {
      mockGetUserDownloads.mockResolvedValue([]);
      mockRecordDownload.mockResolvedValue(undefined);
      const song = { _id: 'song_1', title: 'Test Song', filePath: '/test/song.mp3', fileSize: 16 };

      const req = { user: { userId: 'u1' }, ip: '127.0.0.1', get: jest.fn(() => 'jest-agent'), song };
      const res = createResponse();
      const next = jest.fn();

      const streamData = Readable.from([Buffer.from('abc')]);
      axios.mockResolvedValueOnce({ headers: { 'content-length': '3' }, data: streamData });

      controller.downloadSong(req, res, next);
      await flush();

      expect(mockRecordDownload).toHaveBeenCalledWith({
         user: req.user,
         songId: 'song_1',
         ipAddress: '127.0.0.1',
         userAgent: 'jest-agent'
      });
      expect(res.writeHead).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
   });

   it('downloads with an empty user-agent fallback and rejects invalid host in download mode', async () => {
      mockGetUserDownloads.mockResolvedValue([]);
      mockRecordDownload.mockResolvedValue(undefined);
      mockGetInternalFileUrl.mockReturnValue('https://bad.example.com/test/song.mp3');

      const song = { _id: 'song_1', title: 'Test Song', filePath: '/test/song.mp3', fileSize: 16 };
      const req = { user: { userId: 'u1' }, ip: '127.0.0.1', get: jest.fn(() => undefined), song };
      const res = createResponse();
      const next = jest.fn();

      controller.downloadSong(req, res, next);
      await flush();

      expect(mockRecordDownload).toHaveBeenCalledWith({
         user: req.user,
         songId: 'song_1',
         ipAddress: '127.0.0.1',
         userAgent: ''
      });
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400, message: 'Invalid file source' }));
   });

   it('defaults page and limit when no query params are provided', async () => {
      mockGetAllSongsService.mockResolvedValue({ songs: [], pagination: { totalItems: 0, currentPage: 1, totalPages: 0 } });
      mockGetAllAlbumsService.mockResolvedValue({ albums: [], pagination: { totalItems: 0, currentPage: 1, totalPages: 0 } });

      const songsRes = createResponse();
      controller.getAllSongs({ query: {} }, songsRes, jest.fn());
      await flush();
      expect(songsRes.statusCode).toBe(200);
      expect(songsRes.body.songs.pagination.currentPage).toBe(1);

      const albumsRes = createResponse();
      controller.getAllAlbums({ query: {} }, albumsRes, jest.fn());
      await flush();
      expect(albumsRes.statusCode).toBe(200);
      expect(albumsRes.body.albums.pagination.currentPage).toBe(1);
   });

   it('stream mode rejects invalid range and uses a HEAD fallback when fileSize is missing', async () => {
      const song = { _id: 'song_1', title: 'Range Song', filePath: '/test/song.mp3', fileSize: null };

      const validReq = { headers: { range: 'bytes=0-499' }, song };
      const validRes = createResponse();
      axios.head.mockImplementationOnce((url, options) => {
         expect(typeof options.validateStatus).toBe('function');
         expect(options.validateStatus(200)).toBe(true);
         expect(options.validateStatus(500)).toBe(false);
         return Promise.resolve({ headers: { 'content-length': '1024' } });
      });
      axios.mockResolvedValueOnce({ data: Readable.from([Buffer.from('abc')]) });
      const validNext = jest.fn();

      controller.streamSong(validReq, validRes, validNext);
      await flush();
      expect(validRes.writeHead).toHaveBeenCalled();
      expect(validNext).not.toHaveBeenCalled();

      const invalidReq = { headers: { range: 'bytes=invalid' }, song };
      const invalidRes = createResponse();
      const invalidNext = jest.fn();
      controller.streamSong(invalidReq, invalidRes, invalidNext);
      await flush();
      expect(invalidNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));

      const missingReq = { headers: {}, song };
      const missingRes = createResponse();
      const missingNext = jest.fn();
      controller.streamSong(missingReq, missingRes, missingNext);
      await flush();
      expect(missingNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 416 }));
   });

   it('returns user download history and forwards missing song errors to next', async () => {
      mockGetUserDownloads.mockResolvedValue([{ _id: 'd1' }]);
      const req = { user: { userId: 'u1' } };
      const res = createResponse();
      controller.getMyDownloads(req, res, jest.fn());
      await flush();
      expect(mockGetUserDownloads).toHaveBeenCalledWith('u1');
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ total: 1, downloads: [{ _id: 'd1' }] });

      const next = jest.fn();
      const badReq = { song: null };
      const badRes = createResponse();
      controller.streamSong(badReq, badRes, next);
      await flush();
      expect(next).toHaveBeenCalled();
   });

   it('returns a 400 error when creating a song without an audio file', async () => {
      const req = { body: { title: 'Song' }, user: { userId: 'u1' } };
      const res = createResponse();
      const next = jest.fn();

      controller.createSong(req, res, next);
      await flush();

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400, message: 'Audio file is required' }));
   });

   it('returns a 400 error when search query is missing for songs and artists', async () => {
      const songsReq = { query: {} };
      const songsRes = createResponse();
      const songsNext = jest.fn();
      controller.searchSongs(songsReq, songsRes, songsNext);
      await flush();
      expect(songsNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400, message: 'Search query required' }));

      const artistsReq = { query: {} };
      const artistsRes = createResponse();
      const artistsNext = jest.fn();
      controller.searchArtists(artistsReq, artistsRes, artistsNext);
      await flush();
      expect(artistsNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400, message: 'Search query required' }));
   });

   it('rejects invalid file source for a protected download stream', async () => {
      mockGetInternalFileUrl.mockReturnValue('https://bad.example.com/test.mp3');
      const req = { headers: { range: 'bytes=0-10' }, song: { _id: 'song_1', title: 'Invalid Host', filePath: '/test/song.mp3', fileSize: 100 } };
      const res = createResponse();
      const next = jest.fn();

      controller.streamSong(req, res, next);
      await flush();

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400, message: 'Invalid file source' }));
   });

   it('returns 416 when the requested range starts at or beyond file size', async () => {
      const req = { headers: { range: 'bytes=100-200' }, song: { _id: 'song_1', title: 'Too Far', filePath: '/test/song.mp3', fileSize: 100 } };
      const res = createResponse();
      const next = jest.fn();

      controller.streamSong(req, res, next);
      await flush();

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 416, message: 'Requested range not satisfiable' }));
   });

   it('returns 500 when file size cannot be determined from HEAD fallback', async () => {
      const req = { headers: { range: 'bytes=0-10' }, song: { _id: 'song_1', title: 'Missing Size', filePath: '/test/song.mp3', fileSize: null } };
      const res = createResponse();
      const next = jest.fn();
      axios.head.mockResolvedValueOnce({ headers: {} });

      controller.streamSong(req, res, next);
      await flush();

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 500, message: 'Unable to determine file size' }));
   });

   it('logs and destroys the response when the audio stream errors', async () => {
      const req = { headers: { range: 'bytes=0-10' }, song: { _id: 'song_1', title: 'Bad Stream', filePath: '/test/song.mp3', fileSize: 20 } };
      const res = createResponse();
      const next = jest.fn();
      const EventEmitter = require('events');
      const stream = new EventEmitter();
      stream.pipe = jest.fn().mockReturnValue(res);
      axios.mockResolvedValueOnce({ headers: { 'content-length': '20' }, data: stream });

      controller.streamSong(req, res, next);
      await flush();
      stream.emit('error', new Error('stream failure'));

      expect(mockLoggerError).toHaveBeenCalledWith(expect.objectContaining({ err: expect.any(Error) }), 'Audio stream error');
      expect(res.destroy).toHaveBeenCalledWith(expect.any(Error));
      expect(next).not.toHaveBeenCalled();
   });

   it('downloads without Content-Length when the remote response does not include it', async () => {
      mockGetUserDownloads.mockResolvedValue([]);
      mockRecordDownload.mockResolvedValue(undefined);
      const song = { _id: 'song_1', title: 'Quote "Song" Test', filePath: '/test/song.mp3', fileSize: 16 };
      const req = { user: { userId: 'u1' }, ip: '127.0.0.1', get: jest.fn(() => 'jest-agent'), song };
      const res = createResponse();
      const next = jest.fn();

      axios.mockResolvedValueOnce({ headers: {}, data: Readable.from([Buffer.from('abc')]) });

      controller.downloadSong(req, res, next);
      await flush();

      expect(mockRecordDownload).toHaveBeenCalledWith({
         user: req.user,
         songId: 'song_1',
         ipAddress: '127.0.0.1',
         userAgent: 'jest-agent'
      });
      expect(res.writeHead).toHaveBeenCalledWith(200, expect.not.objectContaining({ 'Content-Length': expect.anything() }));
      expect(next).not.toHaveBeenCalled();
   });

   it('forwards missing song file path errors during streaming', async () => {
      const req = { headers: { range: 'bytes=0-100' }, song: { _id: 'song_1', title: 'Song', filePath: null, fileSize: 32 } };
      const res = createResponse();
      const next = jest.fn();

      controller.streamSong(req, res, next);
      await flush();
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400, message: 'File path missing' }));
   });
});
