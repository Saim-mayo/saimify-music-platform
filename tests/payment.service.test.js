const mockFindByIdAndUpdate = jest.fn();
const mockFindOneAndUpdate = jest.fn();

jest.mock('../src/models/user.model', () => ({
   findByIdAndUpdate: mockFindByIdAndUpdate,
   findOneAndUpdate: mockFindOneAndUpdate
}));

const { setUserPlan, markPastDue, downgradeToFree, clearStripeCustomer } = require('../src/services/payment.service');

describe('payment.service', () => {
   beforeEach(() => {
      jest.clearAllMocks();
   });

   it('requires a status value before updating the user plan', async () => {
      await expect(setUserPlan({}, { plan: 'pro' })).rejects.toThrow("setUserPlan: status is required");
   });

   it('uses userId first, then subscriptionId, then customerId to resolve the user', async () => {
      const session = { id: 's1' };
      const update = {
         'subscription.plan': 'pro',
         'subscription.billingInterval': 'monthly',
         'subscription.status': 'active',
         'subscription.stripeCustomerId': 'cus_1',
         'subscription.stripeSubscriptionId': 'sub_1',
         'subscription.stripePriceId': 'price_1',
         'subscription.expiresAt': null
      };

      mockFindByIdAndUpdate.mockResolvedValue({ _id: 'u1' });
      await expect(setUserPlan({ userId: 'u1', stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_1' }, { plan: 'pro', billingInterval: 'monthly', stripePriceId: 'price_1', status: 'active' }, { session })).resolves.toEqual({ _id: 'u1' });
      expect(mockFindByIdAndUpdate).toHaveBeenCalledWith('u1', update, { session });

      mockFindByIdAndUpdate.mockResolvedValue(null);
      mockFindOneAndUpdate.mockResolvedValueOnce({ _id: 'u2' });
      await expect(setUserPlan({ userId: 'missing', stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_1' }, { plan: 'pro', billingInterval: 'monthly', stripePriceId: 'price_1', status: 'active' }, { session })).resolves.toEqual({ _id: 'u2' });
      expect(mockFindOneAndUpdate).toHaveBeenCalledWith({ 'subscription.stripeSubscriptionId': 'sub_1' }, update, { session });

      mockFindOneAndUpdate.mockResolvedValueOnce(null);
      mockFindOneAndUpdate.mockResolvedValueOnce({ _id: 'u3' });
      await expect(setUserPlan({ userId: 'missing', stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_1' }, { plan: 'pro', billingInterval: 'monthly', stripePriceId: 'price_1', status: 'active' }, { session })).resolves.toEqual({ _id: 'u3' });
      expect(mockFindOneAndUpdate).toHaveBeenLastCalledWith({ 'subscription.stripeCustomerId': 'cus_1' }, update, { session });
   });

   it('marks a subscription as past due and clears the Stripe customer on deletion', async () => {
      await markPastDue('sub_1', 'past_due');
      expect(mockFindOneAndUpdate).toHaveBeenCalledWith({ 'subscription.stripeSubscriptionId': 'sub_1' }, { 'subscription.status': 'past_due' }, {});

      await downgradeToFree('sub_1');
      expect(mockFindOneAndUpdate).toHaveBeenCalledWith({ 'subscription.stripeSubscriptionId': 'sub_1' }, {
         'subscription.plan': 'free',
         'subscription.billingInterval': null,
         'subscription.status': 'canceled',
         'subscription.stripeSubscriptionId': null,
         'subscription.stripePriceId': null,
         'subscription.expiresAt': null
      }, {});

      await clearStripeCustomer('cus_1');
      expect(mockFindOneAndUpdate).toHaveBeenLastCalledWith({ 'subscription.stripeCustomerId': 'cus_1' }, {
         'subscription.plan': 'free',
         'subscription.billingInterval': null,
         'subscription.status': 'canceled',
         'subscription.stripeCustomerId': null,
         'subscription.stripeSubscriptionId': null,
         'subscription.stripePriceId': null,
         'subscription.expiresAt': null
      }, {});
   });
});
