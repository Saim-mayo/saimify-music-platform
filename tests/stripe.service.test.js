const mongoose = require('mongoose');

const mockStripe = {
   customers: {
      create: jest.fn(),
      del: jest.fn()
   },
   checkout: {
      sessions: {
         create: jest.fn()
      }
   },
   subscriptions: {
      retrieve: jest.fn(),
      update: jest.fn(),
      cancel: jest.fn()
   },
   billingPortal: {
      sessions: {
         create: jest.fn()
      }
   }
};

const mockResolvePriceId = jest.fn();
const mockUserFindOneAndUpdate = jest.fn();
const mockUserFindById = jest.fn();

jest.doMock('../src/config/stripe', () => mockStripe);
jest.doMock('../src/config/plans', () => ({
   resolvePriceId: mockResolvePriceId,
   MIN_PAID_LEVEL: 1
}));
jest.doMock('../src/config/env', () => ({
   STRIPE_SUCCESS_URL: 'https://success.example',
   STRIPE_CANCEL_URL: 'https://cancel.example',
   STRIPE_AUTOMATIC_TAX: 'true',
   CLIENT_URL: 'https://client.example'
}));
jest.doMock('../src/models/user.model', () => ({
   findOneAndUpdate: mockUserFindOneAndUpdate,
   findById: mockUserFindById
}));

const { createCheckoutSession, changeSubscriptionPlan, cancelStripeSubscription, resumeStripeSubscription, createBillingPortal } = require('../src/services/stripe.service');

describe('stripe.service', () => {
   beforeEach(() => {
      jest.clearAllMocks();
      mockUserFindOneAndUpdate.mockResolvedValue({ _id: new mongoose.Types.ObjectId() });
      mockUserFindById.mockReturnValue({
         select: jest.fn().mockResolvedValue({
            subscription: { stripeCustomerId: 'cus_new' }
         })
      });
   });

   it('throws when checkout is called without a user', async () => {
      await expect(createCheckoutSession()).rejects.toThrow('User is required');
   });

   it('throws when user is banned', async () => {
      await expect(createCheckoutSession({ isBanned: true }, 'pro', 'monthly')).rejects.toThrow('Account is banned');
   });

   it('throws when the price cannot be resolved', async () => {
      mockResolvePriceId.mockReturnValue(null);
      await expect(createCheckoutSession({ isBanned: false }, 'pro', 'monthly')).rejects.toThrow('Invalid plan or billing interval');
   });

   it('creates a checkout session with the expected Stripe payload and optional trial-day support', async () => {
      mockResolvePriceId.mockReturnValue('price_123');
      mockStripe.customers.create.mockResolvedValue({ id: 'cus_new' });
      mockStripe.checkout.sessions.create.mockResolvedValue({ id: 'sess_123' });

      const user = {
         _id: new mongoose.Types.ObjectId(),
         email: 'user@example.com',
         isBanned: false,
         subscription: { stripeCustomerId: null }
      };

      const result = await createCheckoutSession(user, 'pro', 'monthly', { trialDays: 14 });
      expect(result).toEqual({ id: 'sess_123' });
      expect(mockStripe.customers.create).toHaveBeenCalledTimes(1);
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
         expect.objectContaining({
            mode: 'subscription',
            customer: 'cus_new',
            automatic_tax: { enabled: true },
            subscription_data: expect.objectContaining({ trial_period_days: 14 })
         }),
         expect.any(Object)
      );
   });

   it('returns changed false when switching to the same price id', async () => {
      mockStripe.subscriptions.retrieve.mockResolvedValue({
         items: { data: [{ price: { id: 'same-price-id' } }] }
      });

      const result = await changeSubscriptionPlan('sub_123', 'same-price-id');
      expect(result).toEqual({ changed: false, subscription: expect.any(Object) });
      expect(mockStripe.subscriptions.update).not.toHaveBeenCalled();
   });

   it('updates a subscription and returns the changed response', async () => {
      mockStripe.subscriptions.retrieve.mockResolvedValue({
         items: { data: [{ id: 'item_123', price: { id: 'old-price' } }] }
      });
      mockStripe.subscriptions.update.mockResolvedValue({ id: 'sub_123', ok: true });

      const result = await changeSubscriptionPlan('sub_123', 'new-price');
      expect(result).toEqual({ changed: true, subscription: { id: 'sub_123', ok: true } });
      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_123', expect.objectContaining({
         items: [{ id: 'item_123', price: 'new-price' }]
      }));
   });

   it('cancels immediately or at period end depending on the option', async () => {
      mockStripe.subscriptions.retrieve.mockResolvedValue({ id: 'sub_123' });
      mockStripe.subscriptions.update.mockResolvedValue({ id: 'sub_123', cancel_at_period_end: true });
      mockStripe.subscriptions.cancel.mockResolvedValue({ id: 'sub_123' });

      const scheduled = await cancelStripeSubscription('sub_123', { atPeriodEnd: true });
      expect(scheduled).toEqual({ id: 'sub_123', cancel_at_period_end: true });

      const immediate = await cancelStripeSubscription('sub_123');
      expect(immediate).toEqual({ id: 'sub_123' });
   });

   it('resumes a scheduled subscription cancellation', async () => {
      mockStripe.subscriptions.update.mockResolvedValue({ id: 'sub_123', cancel_at_period_end: false });
      const result = await resumeStripeSubscription('sub_123');
      expect(result).toEqual({ id: 'sub_123', cancel_at_period_end: false });
   });

   it('creates a billing portal session for a customer id', async () => {
      mockStripe.billingPortal.sessions.create.mockResolvedValue({ url: 'https://billing.example' });
      const result = await createBillingPortal('cus_123');
      expect(result).toEqual({ url: 'https://billing.example' });
   });
});
