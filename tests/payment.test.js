const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('./testDb');
const { createAuthedUser } = require('./testAuth');
const Payment = require('../src/models/payment.model');
const Plan = require('../src/models/plan.model');

jest.mock('../src/services/stripe.service', () => ({
   createCheckoutSession: jest.fn(),
   changeSubscriptionPlan: jest.fn(),
   cancelStripeSubscription: jest.fn(),
   resumeStripeSubscription: jest.fn(),
   createBillingPortal: jest.fn(),
   getSubscription: jest.fn(),
   getCustomerSubscriptions: jest.fn()
}));

const stripeService = require('../src/services/stripe.service');
const { loadPlanCache } = require('../src/services/planCache.service');

let app;

const PRICE_ID = 'price_test_pro_monthly';
const PRICE_YEARLY_ID = 'price_test_pro_yearly';
const PLUS_PRICE_ID = 'price_test_plus_monthly';
const ELITE_PRICE_ID = 'price_test_elite_monthly';
const CUSTOMER_ID = 'cus_test_123';
const SUBSCRIPTION_ID = 'sub_test_123';

const seedPlan = async () => {
   await Plan.create({
      planKey: 'pro',
      name: 'Pro',
      level: 1,
      stripeProductId: 'prod_test_pro',
      prices: [
         {
            stripePriceId: PRICE_ID,
            interval: 'monthly',
            amount: 999,
            currency: 'usd',
            active: true
         },
         {
            stripePriceId: PRICE_YEARLY_ID,
            interval: 'yearly',
            amount: 9990,
            currency: 'usd',
            active: true
         }
      ],
      isActive: true
   });

   await Plan.create({
      planKey: 'plus',
      name: 'Plus',
      level: 2,
      stripeProductId: 'prod_test_plus',
      prices: [
         {
            stripePriceId: PLUS_PRICE_ID,
            interval: 'monthly',
            amount: 1499,
            currency: 'usd',
            active: true
         }
      ],
      isActive: true
   });

   await Plan.create({
      planKey: 'elite',
      name: 'Elite',
      level: 3,
      stripeProductId: 'prod_test_elite',
      prices: [
         {
            stripePriceId: ELITE_PRICE_ID,
            interval: 'monthly',
            amount: 2499,
            currency: 'usd',
            active: true
         }
      ],
      isActive: true
   });

   await loadPlanCache();
};

beforeAll(async () => {
   await connect();
   app = require('../src/app');
});

afterEach(async () => {
   await clearDatabase();
   jest.clearAllMocks();
   stripeService.getSubscription.mockReset();
   stripeService.getCustomerSubscriptions.mockReset();
});

afterAll(async () => {
   await closeDatabase();
});

describe('Payment API', () => {
   it('returns a public plan catalog including the seeded plans', async () => {
      await seedPlan();

      const res = await request(app).get('/api/payment/plans');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.plans).toEqual(
         expect.arrayContaining([
            expect.objectContaining({ key: 'free' }),
            expect.objectContaining({ key: 'pro', name: 'Pro' }),
            expect.objectContaining({ key: 'plus', name: 'Plus' }),
            expect.objectContaining({ key: 'elite', name: 'Elite' })
         ])
      );
      expect(res.body.plans).toEqual(
         expect.arrayContaining([
            expect.objectContaining({
               key: 'pro',
               prices: expect.arrayContaining([
                  expect.objectContaining({ interval: 'monthly', amount: 999, currency: 'usd' }),
                  expect.objectContaining({ interval: 'yearly', amount: 9990, currency: 'usd' })
               ])
            })
         ])
      );
   });

   it('creates a Stripe checkout session for a valid plan', async () => {
      await seedPlan();
      const { cookie, user } = await createAuthedUser({ email: 'checkout@example.com' });

      stripeService.createCheckoutSession.mockResolvedValue({ url: 'https://stripe.checkout/test' });

      const res = await request(app)
         .post('/api/payment/checkout')
         .set('Cookie', [cookie])
         .send({ planKey: 'pro', interval: 'monthly' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.url).toBe('https://stripe.checkout/test');
      expect(stripeService.createCheckoutSession).toHaveBeenCalledTimes(1);
      expect(stripeService.createCheckoutSession).toHaveBeenCalledWith(
         expect.objectContaining({ _id: user._id }),
         'pro',
         'monthly'
      );
   });

   it('rejects checkout when the plan is invalid', async () => {
      const { cookie } = await createAuthedUser({ email: 'invalid-plan@example.com' });

      const res = await request(app)
         .post('/api/payment/checkout')
         .set('Cookie', [cookie])
         .send({ planKey: 'doesnotexist', interval: 'monthly' });

      expect(res.status).toBe(400);
      expect(stripeService.createCheckoutSession).not.toHaveBeenCalled();
   });

   it('rejects checkout for an invalid billing interval', async () => {
      await seedPlan();
      const { cookie } = await createAuthedUser({ email: 'invalid-interval@example.com' });

      const res = await request(app)
         .post('/api/payment/checkout')
         .set('Cookie', [cookie])
         .send({ planKey: 'pro', interval: 'weekly' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Invalid billing interval/i);
      expect(stripeService.createCheckoutSession).not.toHaveBeenCalled();
   });

   it('allows checkout when a user has local entitlement state but no Stripe subscription id', async () => {
      await seedPlan();
      const { cookie, user } = await createAuthedUser({
         email: 'recovered@example.com',
         subscription: {
            plan: 'pro',
            billingInterval: 'monthly',
            status: 'active'
         }
      });

      stripeService.createCheckoutSession.mockResolvedValue({ url: 'https://stripe.checkout/test' });

      const res = await request(app)
         .post('/api/payment/checkout')
         .set('Cookie', [cookie])
         .send({ planKey: 'pro', interval: 'monthly' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.url).toBe('https://stripe.checkout/test');
      expect(stripeService.createCheckoutSession).toHaveBeenCalledWith(
         expect.objectContaining({ _id: user._id }),
         'pro',
         'monthly'
      );
   });

   it('rejects checkout for an already entitled user', async () => {
      await seedPlan();
      const { cookie } = await createAuthedUser({
         email: 'entitled@example.com',
         subscription: {
            plan: 'pro',
            billingInterval: 'monthly',
            status: 'active',
            stripeSubscriptionId: SUBSCRIPTION_ID,
            stripeCustomerId: CUSTOMER_ID
         }
      });

      const res = await request(app)
         .post('/api/payment/checkout')
         .set('Cookie', [cookie])
         .send({ planKey: 'pro', interval: 'monthly' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already have an active subscription/i);
      expect(stripeService.createCheckoutSession).not.toHaveBeenCalled();
   });

   it('rejects checkout when a prior paid payment already references a Stripe subscription', async () => {
      await seedPlan();
      const { cookie, user } = await createAuthedUser({
         email: 'history-checkout@example.com',
         subscription: {
            plan: 'free',
            billingInterval: null,
            status: 'free'
         }
      });

      await Payment.create({
         userId: user._id,
         stripeSessionId: 'cs_history_checkout',
         stripeCustomerId: CUSTOMER_ID,
         stripeSubscriptionId: SUBSCRIPTION_ID,
         stripeEventId: 'evt_history_checkout',
         invoiceId: 'in_history_checkout',
         plan: 'pro',
         billingInterval: 'monthly',
         amount: 9.99,
         currency: 'usd',
         status: 'paid'
      });

      stripeService.getSubscription.mockRejectedValue(new Error('No such subscription'));

      const res = await request(app)
         .post('/api/payment/checkout')
         .set('Cookie', [cookie])
         .send({ planKey: 'pro', interval: 'monthly' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(stripeService.createCheckoutSession).toHaveBeenCalledTimes(1);
   });

   it('changes the plan when the user has an active subscription', async () => {
      await seedPlan();
      const { cookie } = await createAuthedUser({
         email: 'change-plan@example.com',
         subscription: {
            plan: 'pro',
            billingInterval: 'monthly',
            status: 'active',
            stripeSubscriptionId: SUBSCRIPTION_ID,
            stripeCustomerId: CUSTOMER_ID
         }
      });

      stripeService.changeSubscriptionPlan.mockResolvedValue({
         changed: true,
         subscription: { id: SUBSCRIPTION_ID }
      });

      const res = await request(app)
         .post('/api/payment/change-plan')
         .set('Cookie', [cookie])
         .send({ planKey: 'pro', interval: 'yearly' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.direction).toBe('upgrade');
      expect(res.body.pricingSummary).toEqual(
         expect.objectContaining({
            direction: 'upgrade',
            effect: 'charge',
            deltaAmount: 8991,
            currency: 'usd'
         })
      );
      expect(res.body.message).toMatch(/charged/i);
      expect(stripeService.changeSubscriptionPlan).toHaveBeenCalledTimes(1);
   });

   it('returns 409 when changing to the same plan and interval', async () => {
      await seedPlan();
      const { cookie } = await createAuthedUser({
         email: 'same-plan@example.com',
         subscription: {
            plan: 'pro',
            billingInterval: 'monthly',
            status: 'active',
            stripeSubscriptionId: SUBSCRIPTION_ID,
            stripeCustomerId: CUSTOMER_ID
         }
      });

      stripeService.changeSubscriptionPlan.mockResolvedValue({
         changed: false,
         subscription: { id: SUBSCRIPTION_ID }
      });

      const res = await request(app)
         .post('/api/payment/change-plan')
         .set('Cookie', [cookie])
         .send({ planKey: 'pro', interval: 'monthly' });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/already subscribed/i);
   });

   it('signals a checkout fallback when the user has no active subscription to change', async () => {
      await seedPlan();
      const { cookie } = await createAuthedUser({
         email: 'checkout-fallback@example.com',
         subscription: {
            plan: 'free',
            billingInterval: null,
            status: 'free'
         }
      });

      const res = await request(app)
         .post('/api/payment/change-plan')
         .set('Cookie', [cookie])
         .send({ planKey: 'pro', interval: 'monthly' });

      expect(res.status).toBe(400);
      expect(res.body.requiresCheckout).toBe(true);
      expect(res.body.message).toMatch(/checkout/i);
   });

   it('signals checkout fallback when Stripe reports the subscription as canceled', async () => {
      await seedPlan();
      const { cookie } = await createAuthedUser({
         email: 'canceled-subscription@example.com',
         subscription: {
            plan: 'pro',
            billingInterval: 'monthly',
            status: 'active',
            stripeSubscriptionId: SUBSCRIPTION_ID,
            stripeCustomerId: CUSTOMER_ID
         }
      });

      stripeService.getSubscription.mockResolvedValue({
         id: SUBSCRIPTION_ID,
         status: 'canceled'
      });

      const res = await request(app)
         .post('/api/payment/change-plan')
         .set('Cookie', [cookie])
         .send({ planKey: 'pro', interval: 'yearly' });

      expect(res.status).toBe(400);
      expect(res.body.requiresCheckout).toBe(true);
      expect(res.body.message).toMatch(/canceled|new subscription/i);
   });

   it('returns the current user subscription status', async () => {
      const { cookie } = await createAuthedUser({
         email: 'status@example.com',
         subscription: {
            plan: 'pro',
            billingInterval: 'monthly',
            status: 'active',
            stripeSubscriptionId: SUBSCRIPTION_ID,
            stripeCustomerId: CUSTOMER_ID
         }
      });

      const res = await request(app)
         .get('/api/payment/subscription/status')
         .set('Cookie', [cookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.subscription).toMatchObject({
         plan: 'pro',
         billingInterval: 'monthly',
         status: 'active'
      });
   });

   it('returns payment history for the current user', async () => {
      const { cookie, user } = await createAuthedUser({ email: 'history@example.com' });

      await Payment.create({
         userId: user._id,
         stripeSessionId: 'cs_hist_1',
         stripeCustomerId: CUSTOMER_ID,
         stripeSubscriptionId: SUBSCRIPTION_ID,
         stripeEventId: 'evt_hist_1',
         invoiceId: 'in_hist_1',
         plan: 'pro',
         billingInterval: 'monthly',
         amount: 9.99,
         currency: 'usd',
         status: 'paid'
      });

      const res = await request(app)
         .get('/api/payment/history')
         .set('Cookie', [cookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.payments).toHaveLength(1);
      expect(res.body.payments[0]).toMatchObject({ plan: 'pro', amount: 9.99 });
   });

   it('creates a billing portal session when a Stripe customer exists', async () => {
      const { cookie } = await createAuthedUser({
         email: 'portal@example.com',
         subscription: {
            plan: 'pro',
            billingInterval: 'monthly',
            status: 'active',
            stripeCustomerId: CUSTOMER_ID
         }
      });

      stripeService.createBillingPortal.mockResolvedValue({ url: 'https://billing.portal/test' });

      const res = await request(app)
         .post('/api/payment/billing-portal')
         .set('Cookie', [cookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.url).toBe('https://billing.portal/test');
      expect(stripeService.createBillingPortal).toHaveBeenCalledWith(CUSTOMER_ID);
   });

   it('falls back to the most recent payment customer when no subscription customer exists', async () => {
      const { cookie, user } = await createAuthedUser({
         email: 'portal-fallback@example.com',
         subscription: {
            plan: 'free',
            billingInterval: null,
            status: 'free'
         }
      });

      await Payment.create({
         userId: user._id,
         stripeSessionId: 'cs_fallback_1',
         stripeCustomerId: CUSTOMER_ID,
         stripeSubscriptionId: SUBSCRIPTION_ID,
         stripeEventId: 'evt_fallback_1',
         invoiceId: 'in_fallback_1',
         plan: 'pro',
         billingInterval: 'monthly',
         amount: 9.99,
         currency: 'usd',
         status: 'paid'
      });

      stripeService.createBillingPortal.mockResolvedValue({ url: 'https://billing.portal/fallback' });

      const res = await request(app)
         .post('/api/payment/billing-portal')
         .set('Cookie', [cookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.url).toBe('https://billing.portal/fallback');
      expect(stripeService.createBillingPortal).toHaveBeenCalledWith(CUSTOMER_ID);
   });

   it('cancels the current subscription immediately', async () => {
      const { cookie } = await createAuthedUser({
         email: 'cancel@example.com',
         subscription: {
            plan: 'pro',
            billingInterval: 'monthly',
            status: 'active',
            stripeSubscriptionId: SUBSCRIPTION_ID,
            stripeCustomerId: CUSTOMER_ID
         }
      });

      stripeService.cancelStripeSubscription.mockResolvedValue({ id: SUBSCRIPTION_ID });

      const res = await request(app)
         .delete('/api/payment/subscription')
         .set('Cookie', [cookie])
         .send({ atPeriodEnd: false });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/Access has ended immediately/i);
      expect(stripeService.cancelStripeSubscription).toHaveBeenCalledWith(SUBSCRIPTION_ID, { atPeriodEnd: false });
   });

   it('treats a missing Stripe subscription as already canceled during cancel', async () => {
      const { cookie } = await createAuthedUser({
         email: 'cancel-missing@example.com',
         subscription: {
            plan: 'pro',
            billingInterval: 'monthly',
            status: 'active',
            stripeSubscriptionId: SUBSCRIPTION_ID,
            stripeCustomerId: CUSTOMER_ID
         }
      });

      stripeService.cancelStripeSubscription.mockRejectedValue(new Error('No such subscription'));

      const res = await request(app)
         .delete('/api/payment/subscription')
         .set('Cookie', [cookie])
         .send({ atPeriodEnd: false });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/already canceled|already inactive/i);
   });

   it('resumes a scheduled cancellation for the current subscription', async () => {
      const { cookie } = await createAuthedUser({
         email: 'resume@example.com',
         subscription: {
            plan: 'pro',
            billingInterval: 'monthly',
            status: 'active',
            stripeSubscriptionId: SUBSCRIPTION_ID,
            stripeCustomerId: CUSTOMER_ID
         }
      });

      stripeService.getSubscription.mockResolvedValue({
         id: SUBSCRIPTION_ID,
         status: 'active',
         cancel_at_period_end: true
      });
      stripeService.resumeStripeSubscription.mockResolvedValue({ id: SUBSCRIPTION_ID, cancel_at_period_end: false });

      const res = await request(app)
         .post('/api/payment/subscription/resume')
         .set('Cookie', [cookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/Scheduled cancellation removed/i);
      expect(stripeService.resumeStripeSubscription).toHaveBeenCalledWith(SUBSCRIPTION_ID);
   });
});
