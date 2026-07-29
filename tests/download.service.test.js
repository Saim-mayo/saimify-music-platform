const mockFindOneAndUpdate = jest.fn();
const mockExists = jest.fn();
const mockCountDocuments = jest.fn();
const mockFind = jest.fn();
const mockGetPlanFeatures = jest.fn();
const mockWithTransactionRetry = jest.fn(async (fn) => fn({}));

jest.mock('../src/models/download.model', () => ({
   findOneAndUpdate: mockFindOneAndUpdate,
   exists: mockExists,
   countDocuments: mockCountDocuments,
   find: mockFind
}));

jest.mock('../src/utils/accessControl', () => ({
   getPlanFeatures: mockGetPlanFeatures
}));

jest.mock('../src/utils/mongoTransaction', () => ({
   withTransactionRetry: mockWithTransactionRetry
}));

const { recordDownload, getUserDownloads } = require('../src/services/download.service');

describe('download.service', () => {
   beforeEach(() => {
      jest.clearAllMocks();
      mockExists.mockReturnValue({ session: jest.fn().mockResolvedValue(true) });
      mockCountDocuments.mockReturnValue({ session: jest.fn().mockResolvedValue(0) });
   });

   it('uses a direct upsert when the plan has unlimited downloads', async () => {
      mockGetPlanFeatures.mockReturnValue({ maxDownloads: null });
      mockFindOneAndUpdate.mockResolvedValue({ _id: 'download_1' });

      await expect(recordDownload({
         user: { userId: 'u1', subscription: { plan: 'pro' } },
         songId: 'song_1',
         ipAddress: '127.0.0.1',
         userAgent: 'jest'
      })).resolves.toEqual({ _id: 'download_1' });

      expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
         { user: 'u1', song: 'song_1' },
         {
            $inc: { downloadCount: 1 },
            $set: { ipAddress: '127.0.0.1', userAgent: 'jest', downloadedAt: expect.any(Date) }
         },
         { upsert: true, returnDocument: 'after' }
      );
   });

   it('transacts a limited-download flow and rejects when the limit has been reached', async () => {
      mockGetPlanFeatures.mockReturnValue({ maxDownloads: 2 });
      mockExists.mockReturnValue({ session: jest.fn().mockResolvedValue(false) });
      mockCountDocuments.mockReturnValue({ session: jest.fn().mockResolvedValue(2) });
      mockFindOneAndUpdate.mockResolvedValue({ _id: 'download_1' });

      await expect(recordDownload({
         user: { userId: 'u1', subscription: { plan: 'pro' } },
         songId: 'song_1',
         ipAddress: '127.0.0.1',
         userAgent: 'jest'
      })).rejects.toMatchObject({ statusCode: 403, message: 'Download limit reached (2 for your plan). Upgrade to download more.' });
   });

   it('returns a sorted download history with populated song metadata', async () => {
      const query = {
         populate: jest.fn().mockReturnThis(),
         sort: jest.fn().mockResolvedValue([{ _id: 'd1' }])
      };
      mockFind.mockReturnValue(query);

      await expect(getUserDownloads('u1')).resolves.toEqual([{ _id: 'd1' }]);
      expect(mockFind).toHaveBeenCalledWith({ user: 'u1' });
      expect(query.populate).toHaveBeenCalledWith('song', 'title artist');
      expect(query.sort).toHaveBeenCalledWith({ downloadedAt: -1 });
   });
});
