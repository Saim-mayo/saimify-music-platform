const mockFindById = jest.fn();
const mockFindOne = jest.fn();
const mockSave = jest.fn();
const mockUploadFile = jest.fn();
const mockCountDocuments = jest.fn();
const mockHash = jest.fn();
const mockGetPlanFeatures = jest.fn();

jest.mock('../src/models/user.model', () => ({
   findById: mockFindById,
   findOne: mockFindOne
}));

jest.mock('../src/services/storage.service', () => ({
   uploadFile: mockUploadFile
}));

jest.mock('../src/utils/accessControl', () => ({
   getPlanFeatures: mockGetPlanFeatures
}));

jest.mock('bcrypt', () => ({
   hash: mockHash
}));

jest.mock('../src/models/download.model', () => ({
   countDocuments: mockCountDocuments
}));

const { getMyProfileService, updateMyProfileService, uploadAvatarService, setPasswordService, getMyFeatureFlagsService } = require('../src/services/user.service');

describe('user.service', () => {
   beforeEach(() => {
      jest.clearAllMocks();
   });

   it('gets a profile or rejects when the user is missing', async () => {
      const user = { _id: 'u1', username: 'artist' };
      mockFindById.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });

      await expect(getMyProfileService('u1')).resolves.toEqual(user);

      mockFindById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
      await expect(getMyProfileService('u1')).rejects.toMatchObject({ statusCode: 404, message: 'User not found' });
   });

   it('updates profile fields and fails when the username is already taken', async () => {
      const user = { username: 'old', bio: 'old bio', avatar: 'avatar.png', save: mockSave };
      mockFindById.mockResolvedValue(user);
      mockFindOne.mockResolvedValue({ _id: 'u2' });

      await expect(updateMyProfileService('u1', { username: 'taken', bio: 'changed' })).rejects.toMatchObject({ statusCode: 409, message: 'Username already taken' });

      mockFindOne.mockResolvedValue(null);
      mockSave.mockResolvedValue(true);
      await expect(updateMyProfileService('u1', { username: ' new ', bio: '  okay  ' })).resolves.toEqual({ username: 'new', bio: 'okay', avatar: 'avatar.png' });
   });

   it('requires an avatar file and uploads it only when the user exists', async () => {
      await expect(uploadAvatarService('u1', null)).rejects.toMatchObject({ statusCode: 400, message: 'Avatar file is required' });

      mockFindById.mockResolvedValue(null);
      await expect(uploadAvatarService('u1', { buffer: Buffer.from('x'), originalname: 'a.png' })).rejects.toMatchObject({ statusCode: 404, message: 'User not found' });

      const user = { avatar: '', save: mockSave };
      mockFindById.mockResolvedValue(user);
      mockUploadFile.mockResolvedValue({ url: 'https://img' });
      mockSave.mockResolvedValue(true);

      await expect(uploadAvatarService('u1', { buffer: Buffer.from('x'), originalname: 'a.png' })).resolves.toEqual({ avatar: 'https://img' });
      expect(mockUploadFile).toHaveBeenCalledWith(Buffer.from('x'), 'a.png', 'ytmusic-clone/avatars');
   });

   it('sets a password only for users without one and rejects missing users', async () => {
      mockFindById.mockResolvedValue(null);
      await expect(setPasswordService('u1', 'pass')).rejects.toMatchObject({ statusCode: 404, message: 'User not found' });

      const user = { password: 'xyz', save: mockSave };
      mockFindById
         .mockReturnValueOnce(user)
         .mockReturnValueOnce({ select: jest.fn().mockResolvedValue({ password: 'hashed' }) });

      await expect(setPasswordService('u1', 'pass')).rejects.toMatchObject({ statusCode: 400, message: 'Password already exists' });

      const freshUser = { save: mockSave };
      mockFindById
         .mockReturnValueOnce(freshUser)
         .mockReturnValueOnce({ select: jest.fn().mockResolvedValue(null) });
      mockHash.mockResolvedValue('hashed');
      mockSave.mockResolvedValue(true);

      await expect(setPasswordService('u1', 'pass')).resolves.toEqual({ success: true });
   });

   it('computes feature flags based on plan features and download usage', async () => {
      mockGetPlanFeatures.mockReturnValue({
         adFree: false,
         canDownload: true,
         maxDownloads: 5,
         dailyPlayLimit: 10
      });
      mockCountDocuments.mockResolvedValue(2);

      await expect(getMyFeatureFlagsService({ userId: 'u1', subscription: { plan: 'pro' } })).resolves.toEqual({
         plan: 'pro',
         showAds: true,
         canDownload: true,
         maxDownloads: 5,
         downloadsUsed: 2,
         downloadsRemaining: 3,
         dailyPlayLimit: 10
      });

      mockGetPlanFeatures.mockReturnValue({
         adFree: true,
         canDownload: true,
         maxDownloads: null,
         dailyPlayLimit: null
      });
      mockCountDocuments.mockResolvedValue(0);
      await expect(getMyFeatureFlagsService({ userId: 'u2', subscription: { plan: 'pro' } })).resolves.toEqual({
         plan: 'pro',
         showAds: false,
         canDownload: true,
         maxDownloads: null,
         downloadsUsed: 0,
         downloadsRemaining: null,
         dailyPlayLimit: null
      });
   });
});
