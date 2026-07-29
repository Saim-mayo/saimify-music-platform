const mockUserFindById = jest.fn();
const mockCanPlaySong = jest.fn();
const mockCanDownloadSong = jest.fn();
const mockCanUpload = jest.fn();

jest.mock('../src/models/user.model', () => ({
   findById: mockUserFindById
}));

jest.mock('../src/utils/accessControl', () => ({
   canPlaySong: mockCanPlaySong,
   canDownloadSong: mockCanDownloadSong,
   canUpload: mockCanUpload
}));

const { allowPlay, allowDownload, allowUpload } = require('../src/middlewares/access.middleware');

describe('access.middleware', () => {
   beforeEach(() => {
      jest.clearAllMocks();
   });

   it('loads the user once for play and stores the access result on req', async () => {
      const user = { _id: 'u1', isBanned: false };
      mockUserFindById.mockResolvedValue(user);
      mockCanPlaySong.mockReturnValue({ allowed: true, unlimited: true });

      const req = { user: { userId: 'u1' } };
      const res = {};
      const next = jest.fn();

      await allowPlay(req, res, next);

      expect(mockUserFindById).toHaveBeenCalledWith('u1');
      expect(req.userDoc).toEqual(user);
      expect(req.access).toEqual({ allowed: true, unlimited: true });
      expect(next).toHaveBeenCalledTimes(1);
   });

   it('passes download authorization through the access-control helper', () => {
      const req = { user: { userId: 'u1' } };
      const next = jest.fn();

      allowDownload(req, {}, next);

      expect(mockCanDownloadSong).toHaveBeenCalledWith(req.user);
      expect(next).toHaveBeenCalledTimes(1);
   });

   it('passes upload authorization through the access-control helper', () => {
      const req = { user: { userId: 'u1' } };
      const next = jest.fn();

      allowUpload(req, {}, next);

      expect(mockCanUpload).toHaveBeenCalledWith(req.user);
      expect(next).toHaveBeenCalledTimes(1);
   });
});
