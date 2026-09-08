const mockUserFindById = jest.fn();
const mockUserFindOneAndUpdate = jest.fn();
const mockIsEntitled = jest.fn();
const mockGetPlanFeatures = jest.fn();

jest.mock('../src/models/user.model', () => ({
   findById: mockUserFindById,
   findOneAndUpdate: mockUserFindOneAndUpdate
}));

jest.mock('../src/utils/accessControl', () => ({
   isEntitled: mockIsEntitled,
   getPlanFeatures: mockGetPlanFeatures
}));

const { checkDailyLimit } = require('../src/middlewares/usage.middleware');

describe('usage.middleware', () => {
   beforeEach(() => {
      jest.clearAllMocks();
   });

   it('short-circuits for paid users who are already entitled', async () => {
      const req = { user: { userId: 'u1' }, userDoc: { subscription: { plan: 'pro', status: 'active' } } };
      const next = jest.fn();
      mockIsEntitled.mockReturnValue(true);

      await checkDailyLimit(req, {}, next);

      expect(mockUserFindById).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
   });

   it('does not consume a free play credit for continuation range requests', async () => {
      const req = {
         user: { userId: 'u1' },
         headers: { range: 'bytes=500-' },
         userDoc: { subscription: { plan: 'free', status: 'active' } }
      };
      const next = jest.fn();

      await checkDailyLimit(req, {}, next);

      expect(mockUserFindById).not.toHaveBeenCalled();
      expect(mockUserFindOneAndUpdate).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
   });

   it('increments a free user with unlimited daily plays and stores the updated doc', async () => {
      mockUserFindById.mockResolvedValue({ _id: 'u1' });
      mockGetPlanFeatures.mockReturnValue({ dailyPlayLimit: null });
      mockUserFindOneAndUpdate.mockResolvedValue({ _id: 'u1', dailyUsage: { date: '2026-07-22', plays: 1 } });

      const req = { user: { userId: 'u1' }, userDoc: { subscription: { plan: 'free', status: 'active' } } };
      const next = jest.fn();

      await checkDailyLimit(req, {}, next);

      expect(mockUserFindById).toHaveBeenCalledWith('u1');
      expect(mockUserFindOneAndUpdate).toHaveBeenCalledTimes(1);
      expect(req.userDoc).toEqual({ _id: 'u1', dailyUsage: { date: '2026-07-22', plays: 1 } });
      expect(req.dbUser).toEqual({ _id: 'u1', dailyUsage: { date: '2026-07-22', plays: 1 } });
      expect(next).toHaveBeenCalledTimes(1);
   });

   it('returns a 403 when the user has already hit the per-day limit', async () => {
      mockUserFindById.mockResolvedValue({ _id: 'u1' });
      mockGetPlanFeatures.mockReturnValue({ dailyPlayLimit: 2 });
      mockUserFindOneAndUpdate.mockResolvedValue(null);

      const req = { user: { userId: 'u1' }, userDoc: { subscription: { plan: 'free', status: 'active' } } };
      const next = jest.fn();

      await checkDailyLimit(req, {}, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403, message: 'Daily limit reached' }));
   });

   it('returns 404 when a free user cannot be loaded', async () => {
      mockUserFindById.mockResolvedValue(null);

      const req = { user: { userId: 'u1' }, userDoc: { subscription: { plan: 'free', status: 'active' } } };
      const next = jest.fn();

      await checkDailyLimit(req, {}, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404, message: 'User not found' }));
   });
});
