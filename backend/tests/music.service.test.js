const mongoose = require('mongoose');

const mockMusicFindOne = jest.fn();
const mockMusicFind = jest.fn();
const mockMusicCountDocuments = jest.fn();
const mockMusicCreate = jest.fn();
const mockAlbumFind = jest.fn();
const mockAlbumCountDocuments = jest.fn();
const mockAlbumCreate = jest.fn();
const mockHistoryCreate = jest.fn();
const mockHistoryUpdateOne = jest.fn();
const mockHistoryFind = jest.fn();
const mockUserFind = jest.fn();
const mockUploadFile = jest.fn();
const mockAlbumFindById = jest.fn();

const buildQuery = () => ({
   populate: jest.fn().mockReturnThis(),
   sort: jest.fn().mockReturnThis(),
   skip: jest.fn().mockReturnThis(),
   limit: jest.fn().mockReturnThis(),
   lean: jest.fn().mockResolvedValue([])
});

jest.mock('../src/models/music.model', () => ({
   findOne: mockMusicFindOne,
   find: mockMusicFind,
   countDocuments: mockMusicCountDocuments,
   create: mockMusicCreate
}));

jest.mock('../src/models/album.model', () => ({
   find: mockAlbumFind,
   countDocuments: mockAlbumCountDocuments,
   create: mockAlbumCreate,
   findById: mockAlbumFindById
}));

jest.mock('../src/models/history.model', () => ({
   create: mockHistoryCreate,
   updateOne: mockHistoryUpdateOne,
   find: mockHistoryFind
}));

jest.mock('../src/models/user.model', () => ({
   find: mockUserFind
}));

jest.mock('../src/services/storage.service', () => ({
   uploadFile: mockUploadFile
}));

const {
   getSongById,
   createSongService,
   playSongService,
   searchSongsService,
   searchArtistsService,
   createAlbumService,
   getAllSongsService,
   getAllAlbumsService,
   getAlbumByIdService,
   getTrendingSongsService,
   getUserHistoryService
} = require('../src/services/music.service');

describe('music.service', () => {
   beforeEach(() => {
      jest.clearAllMocks();
      jest.spyOn(mongoose.Types.ObjectId, 'isValid').mockReturnValue(true);
   });

   afterEach(() => {
      jest.restoreAllMocks();
   });

   it('throws for invalid song ids and missing songs', async () => {
      jest.spyOn(mongoose.Types.ObjectId, 'isValid').mockReturnValue(false);
      await expect(getSongById('bad-id')).rejects.toMatchObject({ statusCode: 400, message: 'Invalid song id' });

      jest.spyOn(mongoose.Types.ObjectId, 'isValid').mockReturnValue(true);
      mockMusicFindOne.mockResolvedValue(null);

      await expect(getSongById('507f1f77bcf86cd799439011')).rejects.toMatchObject({ statusCode: 404, message: 'Song not found' });
   });

   it('creates a song only when title and file buffer are present', async () => {
      mockUploadFile.mockResolvedValue({ fileId: 'fid', filePath: '/tmp/test.mp3', fileSize: 123 });
      const createdSong = { _id: 'song-1' };
      mockMusicCreate.mockResolvedValue(createdSong);

      await expect(createSongService({ title: '', file: { buffer: Buffer.from('x') }, userId: 'u1' })).rejects.toMatchObject({ statusCode: 400, message: 'Title is required' });
      await expect(createSongService({ title: 'Song', file: null, userId: 'u1' })).rejects.toMatchObject({ statusCode: 400, message: 'Valid audio file is required' });

      const result = await createSongService({ title: ' Song ', file: { buffer: Buffer.from('x'), originalname: 'track.mp3' }, userId: 'u1' });
      expect(mockUploadFile).toHaveBeenCalledWith(Buffer.from('x'), 'track.mp3');
      expect(mockMusicCreate).toHaveBeenCalledWith(expect.objectContaining({ title: 'Song', artist: 'u1' }));
      expect(result).toEqual(createdSong);
   });

   it('fails upload creation when the storage upload does not return a file path', async () => {
      mockUploadFile.mockResolvedValue({ fileId: 'fid' });

      await expect(createSongService({ title: 'Song', file: { buffer: Buffer.from('x'), originalname: 'track.mp3' }, userId: 'u1' })).rejects.toMatchObject({ statusCode: 500, message: 'File upload failed' });
   });

   it('persists genre on uploaded songs and albums', async () => {
      mockUploadFile.mockResolvedValue({ fileId: 'fid', filePath: '/tmp/test.mp3', fileSize: 123 });
      mockMusicCreate.mockResolvedValue({ _id: 'song-genre' });

      await createSongService({
         title: 'Genre Song',
         file: { buffer: Buffer.from('x'), originalname: 'track.mp3' },
         userId: 'u1',
         genre: 'Pop'
      });

      expect(mockMusicCreate).toHaveBeenCalledWith(expect.objectContaining({ genre: 'Pop' }));

      mockMusicFind.mockResolvedValue([{ _id: 'id1', artist: 'u1' }]);
      mockAlbumCreate.mockResolvedValue({ _id: 'album-genre' });
      await createAlbumService({ title: 'Genre Album', musics: ['id1'], userId: 'u1', genre: 'Indie' });
      expect(mockAlbumCreate).toHaveBeenCalledWith(expect.objectContaining({ genre: 'Indie' }));
   });

   it('persists optional cover art for songs and albums', async () => {
      mockUploadFile.mockResolvedValue({ fileId: 'fid', filePath: '/tmp/test.mp3', fileSize: 123 });
      mockMusicCreate.mockResolvedValue({ _id: 'song-3' });

      await createSongService({
         title: 'Cover Song',
         file: { buffer: Buffer.from('x'), originalname: 'track.mp3' },
         userId: 'u1',
         cover: { buffer: Buffer.from('y'), originalname: 'cover.jpg' }
      });

      expect(mockMusicCreate).toHaveBeenCalledWith(expect.objectContaining({
         coverUrl: '',
         coverFileId: 'fid'
      }));

      mockMusicFind.mockResolvedValue([{ _id: 'id1', artist: 'u1' }]);
      mockAlbumCreate.mockResolvedValue({ _id: 'album-2' });
      await createAlbumService({ title: 'Album', musics: ['id1'], userId: 'u1', cover: { url: 'https://example.com/cover.jpg', fileId: 'cover-1' } });
      expect(mockAlbumCreate).toHaveBeenCalledWith(expect.objectContaining({
         coverUrl: 'https://example.com/cover.jpg',
         coverFileId: 'cover-1'
      }));
   });

   it('plays a song and records history', async () => {
      const mockSong = { _id: 'song-1', playCount: 0, save: jest.fn().mockResolvedValue(true) };
      mockMusicFindOne.mockResolvedValue(mockSong);
      mockHistoryUpdateOne.mockResolvedValue({});

      const result = await playSongService({ songId: '507f1f77bcf86cd799439011', userId: 'user-1' });

      expect(mockSong.save).toHaveBeenCalledTimes(1);
      expect(mockHistoryUpdateOne).toHaveBeenCalledWith(
         { user: 'user-1', song: 'song-1' },
         { $set: { playedAt: expect.any(Date) } },
         { upsert: true }
      );
      expect(result).toBe(mockSong);
   });

   it('requires a non-empty search query for songs and artists', async () => {
      await expect(searchSongsService('   ')).rejects.toMatchObject({ statusCode: 400, message: 'Search query is required' });
      await expect(searchArtistsService('')).rejects.toMatchObject({ statusCode: 400, message: 'Search query is required' });
   });

   it('searches songs and artists with safe regex filtering', async () => {
      const songQuery = buildQuery();
      songQuery.lean.mockResolvedValue([{ title: 'My Song' }]);
      mockMusicFind.mockReturnValue(songQuery);

      const songs = await searchSongsService('my', 'Pop');
      expect(mockMusicFind).toHaveBeenCalledWith(expect.objectContaining({
         title: { $regex: 'my', $options: 'i' },
         genre: { $regex: '^Pop$', $options: 'i' }
      }));
      expect(songs).toEqual([{ title: 'My Song' }]);

      const artistQuery = {
         select: jest.fn().mockReturnThis(),
         limit: jest.fn().mockReturnThis(),
         lean: jest.fn().mockResolvedValue([{ username: 'artist-1' }])
      };
      mockUserFind.mockReturnValue(artistQuery);

      const artists = await searchArtistsService('art');
      expect(mockUserFind).toHaveBeenCalledWith(expect.objectContaining({
         username: { $regex: 'art', $options: 'i' },
         role: 'artist'
      }));
      expect(artists).toEqual([{ username: 'artist-1' }]);
   });

   it('validates album creation inputs and ownership before saving', async () => {
      await expect(createAlbumService({ title: '', musics: [], userId: 'u1' })).rejects.toMatchObject({ statusCode: 400, message: 'Title is required' });
      await expect(createAlbumService({ title: 'Album', musics: 'not-array', userId: 'u1' })).rejects.toMatchObject({ statusCode: 400, message: 'Musics must be an array' });
      await expect(createAlbumService({ title: 'Album', musics: [], userId: 'u1' })).rejects.toMatchObject({ statusCode: 400, message: 'Album must contain at least one song' });

      mockMusicFind.mockResolvedValue([{ _id: 'id1', artist: 'u1' }]);
      await expect(createAlbumService({ title: 'Album', musics: ['id1', 'id2'], userId: 'u1' })).rejects.toMatchObject({ statusCode: 404, message: 'One or more songs not found' });

      mockMusicFind.mockResolvedValue([{ _id: 'id1', artist: 'u1' }, { _id: 'id2', artist: 'other' }]);
      await expect(createAlbumService({ title: 'Album', musics: ['id1', 'id2'], userId: 'u1' })).rejects.toMatchObject({ statusCode: 403, message: 'You can only add your own songs to an album' });

      mockMusicFind.mockResolvedValue([{ _id: 'id1', artist: 'u1' }]);
      mockAlbumCreate.mockResolvedValue({ _id: 'album-1' });
      const created = await createAlbumService({ title: 'Album', musics: ['id1'], userId: 'u1' });
      expect(created).toEqual({ _id: 'album-1' });
   });

   it('paginates songs and albums using the provided page and limit values', async () => {
      const songQuery = buildQuery();
      const albumQuery = buildQuery();
      mockMusicFind.mockReturnValue(songQuery);
      mockMusicCountDocuments.mockResolvedValue(3);
      songQuery.lean.mockResolvedValue([{ title: 'a' }]);
      mockAlbumFind.mockReturnValue(albumQuery);
      mockAlbumCountDocuments.mockResolvedValue(1);
      albumQuery.lean.mockResolvedValue([{ title: 'b' }]);

      const songs = await getAllSongsService({ page: '2', limit: '5' });
      expect(songs.pagination).toEqual({ totalItems: 3, currentPage: 2, totalPages: 1 });
      expect(songQuery.skip).toHaveBeenCalledWith(5);
      expect(songQuery.limit).toHaveBeenCalledWith(5);

      const albums = await getAllAlbumsService({ page: '1', limit: '10' });
      expect(albums.pagination).toEqual({ totalItems: 1, currentPage: 1, totalPages: 1 });
      expect(albumQuery.skip).toHaveBeenCalledWith(0);
      expect(albumQuery.limit).toHaveBeenCalledWith(10);
   });

   it('gets album by id and trending/user history flows', async () => {
      jest.spyOn(mongoose.Types.ObjectId, 'isValid').mockReturnValue(false);
      await expect(getAlbumByIdService('bad-id')).rejects.toMatchObject({ statusCode: 400, message: 'Invalid albumId' });

      jest.spyOn(mongoose.Types.ObjectId, 'isValid').mockReturnValue(true);
      const albumChain = {
         populate: jest.fn().mockImplementation(() => ({
            populate: jest.fn().mockResolvedValue({ title: 'Album' })
         }))
      };
      const missingAlbumChain = {
         populate: jest.fn().mockImplementation(() => ({
            populate: jest.fn().mockResolvedValue(null)
         }))
      };
      mockAlbumFindById
         .mockReturnValueOnce(albumChain)
         .mockReturnValueOnce(missingAlbumChain);

      const album = await getAlbumByIdService('507f1f77bcf86cd799439011');
      expect(album.title).toBe('Album');
      await expect(getAlbumByIdService('507f1f77bcf86cd799439011')).rejects.toMatchObject({ statusCode: 404, message: 'Album not found' });

      const trendingQuery = buildQuery();
      trendingQuery.lean.mockResolvedValue([{ title: 'Top song' }]);
      mockMusicFind.mockReturnValue(trendingQuery);
      const trending = await getTrendingSongsService();
      expect(trending).toEqual([{ title: 'Top song' }]);

      const historyQuery = {
         sort: jest.fn().mockReturnThis(),
         limit: jest.fn().mockReturnThis(),
         populate: jest.fn().mockResolvedValue([])
      };
      mockHistoryFind.mockReturnValue(historyQuery);
      const history = await getUserHistoryService('user-1');
      expect(history).toEqual([]);
   });

   it('deduplicates recent history so each song appears once with the latest play time', async () => {
      const historyQuery = {
         sort: jest.fn().mockReturnThis(),
         limit: jest.fn().mockReturnThis(),
         populate: jest.fn().mockResolvedValue([
            { _id: 'h1', song: { _id: 'song-1', title: 'Song 1', artist: { _id: 'artist-1', username: 'Artist' } }, playedAt: new Date('2024-01-01') },
            { _id: 'h2', song: { _id: 'song-1', title: 'Song 1', artist: { _id: 'artist-1', username: 'Artist' } }, playedAt: new Date('2024-01-02') },
            { _id: 'h3', song: { _id: 'song-2', title: 'Song 2', artist: { _id: 'artist-2', username: 'Artist 2' } }, playedAt: new Date('2024-01-03') },
         ])
      };
      mockHistoryFind.mockReturnValue(historyQuery);

      const history = await getUserHistoryService('user-1');

      expect(history).toHaveLength(2);
      expect(history[0].song._id).toBe('song-2');
      expect(history[1].song._id).toBe('song-1');
      expect(history[0].playedAt).toEqual(new Date('2024-01-03'));
      expect(history[1].playedAt).toEqual(new Date('2024-01-02'));
   });

   it('handles empty search results, trending with no songs, and invalid pagination fallbacks', async () => {
      const songSearchQuery = buildQuery();
      songSearchQuery.lean.mockResolvedValue([]);
      mockMusicFind.mockReturnValue(songSearchQuery);

      const songs = await searchSongsService('nomatch');
      expect(songs).toEqual([]);
      expect(mockMusicFind).toHaveBeenCalledWith(expect.objectContaining({
         title: { $regex: 'nomatch', $options: 'i' },
         status: 'active',
         deletedAt: null,
         visibility: 'public'
      }));

      const artistQuery = {
         select: jest.fn().mockReturnThis(),
         limit: jest.fn().mockReturnThis(),
         lean: jest.fn().mockResolvedValue([])
      };
      mockUserFind.mockReturnValue(artistQuery);
      const artists = await searchArtistsService('nomatch');
      expect(artists).toEqual([]);

      const pageQuery = buildQuery();
      pageQuery.lean.mockResolvedValue([]);
      mockMusicFind.mockReturnValue(pageQuery);
      mockMusicCountDocuments.mockResolvedValue(0);

      const emptyPage = await getAllSongsService({ page: '0', limit: 'abc' });
      expect(emptyPage.pagination).toEqual({
         totalItems: 0,
         currentPage: 1,
         totalPages: 0
      });
      expect(pageQuery.skip).toHaveBeenCalledWith(0);
      expect(pageQuery.limit).toHaveBeenCalledWith(20);

      const emptyPageDefaults = await getAllSongsService({});
      expect(emptyPageDefaults.pagination).toEqual({
         totalItems: 0,
         currentPage: 1,
         totalPages: 0
      });

      const albumQuery = buildQuery();
      albumQuery.lean.mockResolvedValue([]);
      mockAlbumFind.mockReturnValue(albumQuery);
      mockAlbumCountDocuments.mockResolvedValue(0);

      const emptyAlbums = await getAllAlbumsService({ page: '0', limit: 'foo' });
      expect(emptyAlbums.pagination).toEqual({
         totalItems: 0,
         currentPage: 1,
         totalPages: 0
      });
      expect(albumQuery.skip).toHaveBeenCalledWith(0);
      expect(albumQuery.limit).toHaveBeenCalledWith(20);

      const emptyAlbumsDefaults = await getAllAlbumsService({});
      expect(emptyAlbumsDefaults.pagination).toEqual({
         totalItems: 0,
         currentPage: 1,
         totalPages: 0
      });

      const trendingQuery = buildQuery();
      trendingQuery.lean.mockResolvedValue([]);
      mockMusicFind.mockReturnValue(trendingQuery);
      const trending = await getTrendingSongsService();
      expect(trending).toEqual([]);
   });

   it('creates a song with null fileSize when upload result omits it', async () => {
      mockUploadFile.mockResolvedValue({ fileId: 'fid', filePath: '/tmp/test.mp3' });
      mockMusicCreate.mockResolvedValue({ _id: 'song-2', fileSize: null });

      const result = await createSongService({ title: 'Song', file: { buffer: Buffer.from('x'), originalname: 'track.mp3' }, userId: 'u1' });
      expect(mockMusicCreate).toHaveBeenCalledWith(expect.objectContaining({ fileSize: null }));
      expect(result).toEqual({ _id: 'song-2', fileSize: null });
   });
});
