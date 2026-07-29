const AppError = require('../src/utils/appError');

jest.mock('../src/models/user.model', () => ({ findById: jest.fn() }));

const userModel = require('../src/models/user.model');
const { requireVerifiedArtist, requireAdmin, requireUser, isArtist, isAdmin } = require('../src/middlewares/permission.middleware');

describe('permission.middleware', () => {
   const mockNext = jest.fn();

   beforeEach(() => {
      jest.clearAllMocks();
   });

   it('rejects when req.user is missing in attachFreshUser', async () => {
      const req = {};
      const res = {};
      await requireAdmin[0](req, res, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ message: 'Unauthorized', statusCode: 401 }));
   });

   it('rejects when the fresh user record is missing', async () => {
      userModel.findById.mockResolvedValue(null);
      const req = { user: { userId: 'user-1' } };
      const res = {};
      await requireUser[0](req, res, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ message: 'User not found', statusCode: 401 }));
   });

   it('rejects banned users before any role checks', async () => {
      userModel.findById.mockResolvedValue({ isBanned: true });
      const req = { user: { userId: 'user-1' } };
      const res = {};
      await requireAdmin[0](req, res, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ message: 'Account banned', statusCode: 403 }));
   });

   it('allows verified artists through the full chain', async () => {
      const dbUser = {
         role: 'artist',
         isBanned: false,
         artistVerification: { status: 'approved', isVerified: true }
      };
      userModel.findById.mockResolvedValue(dbUser);
      const req = { user: { userId: 'user-1' } };
      const res = {};

      await requireVerifiedArtist[0](req, res, mockNext);
      await requireVerifiedArtist[1](req, res, mockNext);

      expect(req.dbUser).toBe(dbUser);
      expect(mockNext).toHaveBeenCalledTimes(2);
   });

   it('rejects non-artists from requireVerifiedArtist', async () => {
      userModel.findById.mockResolvedValue({ role: 'user', isBanned: false, artistVerification: { status: 'approved', isVerified: true } });
      const req = { user: { userId: 'user-1' } };
      const res = {};

      await requireVerifiedArtist[0](req, res, mockNext);
      await requireVerifiedArtist[1](req, res, mockNext);

      expect(mockNext).toHaveBeenLastCalledWith(expect.objectContaining({ message: 'Artist only', statusCode: 403 }));
   });

   it('rejects admins unless role is admin', async () => {
      userModel.findById.mockResolvedValue({ role: 'user', isBanned: false });
      const req = { user: { userId: 'user-1' } };
      const res = {};

      await requireAdmin[0](req, res, mockNext);
      await requireAdmin[1](req, res, mockNext);

      expect(mockNext).toHaveBeenLastCalledWith(expect.objectContaining({ message: 'Admin only', statusCode: 403 }));
   });

   it('rejects users unless role is user', async () => {
      userModel.findById.mockResolvedValue({ role: 'artist', isBanned: false });
      const req = { user: { userId: 'user-1' } };
      const res = {};

      await requireUser[0](req, res, mockNext);
      await requireUser[1](req, res, mockNext);

      expect(mockNext).toHaveBeenLastCalledWith(expect.objectContaining({ message: 'User only', statusCode: 403 }));
   });

   it('supports the JWT-only artist/admin checks', () => {
      const req = { user: { role: 'artist' } };
      const res = {};
      isArtist(req, res, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);

      const req2 = { user: { role: 'admin' } };
      isAdmin(req2, res, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(2);
   });

   it('rejects JWT-only checks when req.user is missing or role mismatch', () => {
      isArtist({}, {}, mockNext);
      expect(mockNext).toHaveBeenLastCalledWith(expect.objectContaining({ message: 'Unauthorized', statusCode: 401 }));

      isAdmin({ user: { role: 'user' } }, {}, mockNext);
      expect(mockNext).toHaveBeenLastCalledWith(expect.objectContaining({ message: 'Admin only', statusCode: 403 }));
   });
});
