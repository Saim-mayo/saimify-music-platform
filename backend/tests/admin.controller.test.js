const mockLogAdminAction = jest.fn();
const mockCancelStripeSubscription = jest.fn();
const mockUserFindById = jest.fn();
const mockRefreshDeleteMany = jest.fn();

jest.mock('../src/services/adminAudit.service', () => ({
   logAdminAction: mockLogAdminAction
}));

jest.mock('../src/services/stripe.service', () => ({
   cancelStripeSubscription: mockCancelStripeSubscription
}));

jest.mock('../src/models/user.model', () => ({
   findById: mockUserFindById
}));

jest.mock('../src/models/refreshToken.model', () => ({
   deleteMany: mockRefreshDeleteMany
}));

const controller = require('../src/controllers/admin.controller');

const flush = () => new Promise((resolve) => setImmediate(resolve));
const createResponse = () => ({
   statusCode: 200,
   body: undefined,
   status(code) {
      this.statusCode = code;
      return this;
   },
   json(payload) {
      this.body = payload;
      return this;
   }
});

describe('admin.controller', () => {
   beforeEach(() => {
      jest.clearAllMocks();
   });

   it('logs admin ban actions after a successful ban', async () => {
      const user = {
         _id: '507f1f77bcf86cd799439011',
         isBanned: false,
         tokenVersion: 0,
         save: jest.fn().mockResolvedValue(true)
      };

      mockUserFindById.mockResolvedValue(user);
      mockRefreshDeleteMany.mockResolvedValue(true);
      mockLogAdminAction.mockResolvedValue({ success: true });

      const req = {
         params: { userId: '507f1f77bcf86cd799439011' },
         user: { userId: '507f1f77bcf86cd799439012' }
      };
      const res = createResponse();

      await controller.banUser(req, res, jest.fn());
      await flush();

      expect(mockLogAdminAction).toHaveBeenCalledWith(expect.objectContaining({
         action: 'ban_user',
         targetUser: expect.objectContaining({ _id: '507f1f77bcf86cd799439011' })
      }));
      expect(res.statusCode).toBe(200);
   });

   it('cancels a user subscription through the existing Stripe helper and logs it', async () => {
      const user = {
         _id: '507f1f77bcf86cd799439011',
         subscription: {
            stripeSubscriptionId: 'sub_123',
            status: 'active'
         }
      };

      mockUserFindById.mockResolvedValue(user);
      mockCancelStripeSubscription.mockResolvedValue({ id: 'sub_123' });
      mockLogAdminAction.mockResolvedValue({ success: true });

      const req = {
         params: { userId: '507f1f77bcf86cd799439011' },
         user: { userId: '507f1f77bcf86cd799439012' }
      };
      const res = createResponse();

      await controller.cancelUserSubscription(req, res, jest.fn());
      await flush();

      expect(mockCancelStripeSubscription).toHaveBeenCalledWith('sub_123', { atPeriodEnd: false });
      expect(mockLogAdminAction).toHaveBeenCalledWith(expect.objectContaining({
         action: 'cancel_subscription',
         metadata: expect.objectContaining({ stripeSubscriptionId: 'sub_123' })
      }));
      expect(res.statusCode).toBe(200);
   });
});
