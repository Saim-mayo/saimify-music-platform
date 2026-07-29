const mockFindById = jest.fn();
const mockGetEffectiveLevel = jest.fn();

jest.mock('../src/models/music.model', () => ({
   findById: mockFindById
}));

jest.mock('../src/utils/accessControl', () => ({
   getEffectiveLevel: mockGetEffectiveLevel
}));

jest.mock('../src/config/plans', () => ({
   MIN_PAID_LEVEL: 1
}));

const { verifyMediaAccess } = require('../src/middlewares/mediaAccess.middleware');

const next = jest.fn();
const createReq = (overrides = {}) => ({
   params: { songId: 'song_1' },
   userDoc: { _id: 'user_1' },
   ...overrides
});

describe('mediaAccess.middleware', () => {
   beforeEach(() => {
      jest.clearAllMocks();
   });

   it('rejects when the song cannot be found', async () => {
      mockFindById.mockResolvedValue(null);
      const req = createReq();
      await verifyMediaAccess()(req, {}, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404, message: 'Song not found' }));
   });

   it('rejects when the user context is missing', async () => {
      mockFindById.mockResolvedValue({
         _id: 'song_1',
         deletedAt: null,
         status: 'active',
         processingFinished: true,
         visibility: 'public',
         premiumOnly: false,
         allowDownload: true,
         artist: 'artist_1'
      });

      await verifyMediaAccess()(createReq({ userDoc: undefined, dbUser: undefined }), {}, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 500, message: 'User context missing. Verify middleware execution order.' }));
   });

   it('throws when a soft-deleted song is requested', async () => {
      mockFindById.mockResolvedValue({
         _id: 'song_1',
         deletedAt: new Date(),
         status: 'active',
         processingFinished: true,
         visibility: 'public',
         premiumOnly: false,
         allowDownload: true,
         artist: 'artist_1'
      });

      await verifyMediaAccess()(createReq(), {}, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404, message: 'Song not found' }));
   });

   it('blocks inactive, processing, and private songs with the correct statuses', async () => {
      mockFindById.mockResolvedValue({
         _id: 'song_1',
         deletedAt: null,
         status: 'inactive',
         processingFinished: true,
         visibility: 'public',
         premiumOnly: false,
         allowDownload: true,
         artist: 'artist_1'
      });

      await verifyMediaAccess()(createReq(), {}, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403, message: 'Song unavailable' }));

      mockFindById.mockResolvedValue({
         _id: 'song_1',
         deletedAt: null,
         status: 'active',
         processingFinished: false,
         visibility: 'public',
         premiumOnly: false,
         allowDownload: true,
         artist: 'artist_1'
      });

      await verifyMediaAccess()(createReq(), {}, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409, message: 'Song still processing' }));

      mockFindById.mockResolvedValue({
         _id: 'song_1',
         deletedAt: null,
         status: 'active',
         processingFinished: true,
         visibility: 'private',
         premiumOnly: false,
         allowDownload: true,
         artist: 'artist_2'
      });

      await verifyMediaAccess()(createReq(), {}, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403, message: 'Unauthorized' }));
   });

   it('requires a paid plan for premium songs and rejects downloads when disabled', async () => {
      mockGetEffectiveLevel.mockReturnValue(0);
      mockFindById.mockResolvedValue({
         _id: 'song_1',
         deletedAt: null,
         status: 'active',
         processingFinished: true,
         visibility: 'public',
         premiumOnly: true,
         allowDownload: true,
         artist: 'artist_1'
      });

      await verifyMediaAccess()(createReq(), {}, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403, message: 'A paid plan is required' }));

      mockGetEffectiveLevel.mockReturnValue(1);
      mockFindById.mockResolvedValue({
         _id: 'song_1',
         deletedAt: null,
         status: 'active',
         processingFinished: true,
         visibility: 'public',
         premiumOnly: false,
         allowDownload: false,
         artist: 'artist_1'
      });

      await verifyMediaAccess('download')(createReq(), {}, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403, message: 'Downloads disabled' }));
   });

   it('attaches the song and user context on success', async () => {
      mockGetEffectiveLevel.mockReturnValue(1);
      mockFindById.mockResolvedValue({
         _id: 'song_1',
         deletedAt: null,
         status: 'active',
         processingFinished: true,
         visibility: 'public',
         premiumOnly: false,
         allowDownload: true,
         artist: 'artist_1'
      });

      const req = createReq();
      const res = {};
      await verifyMediaAccess()(req, res, next);

      expect(req.song._id).toBe('song_1');
      expect(req.dbUser).toEqual(req.userDoc);
      expect(next).toHaveBeenCalledTimes(1);
   });
});
