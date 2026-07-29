const request = require('supertest');

// The webhook route only needs stripe.webhooks.constructEvent (signature
// verification) and stripe.subscriptions.retrieve (to read the full
// subscription after a checkout/invoice event). Mocking the Stripe SDK
// client itself means these tests never make a real network call to
// Stripe, and each test controls exactly what "Stripe" hands back.
jest.mock('../src/config/stripe', () => ({
   webhooks: { constructEvent: jest.fn() },
   subscriptions: { retrieve: jest.fn() }
}));

const stripe = require('../src/config/stripe');
const { connect, closeDatabase, clearDatabase } = require('./testDb');

let app;
let User;
let Payment;
let WebhookEvent;
let Plan;
let loadPlanCache;

const PRICE_ID = 'price_test_pro_monthly';
const CUSTOMER_ID = 'cus_test_123';
const SUBSCRIPTION_ID = 'sub_test_123';

beforeAll(async () => {
   await connect();
   app = require('../src/app');
   User = require('../src/models/user.model');
   Payment = require('../src/models/payment.model');
   WebhookEvent = require('../src/models/webhookEvent.model');
   Plan = require('../src/models/plan.model');
   ({ loadPlanCache } = require('../src/services/planCache.service'));
});

afterEach(async () => {
   await clearDatabase();
   jest.clearAllMocks();
});

afterAll(async () => {
   await closeDatabase();
});

/**
 * Seeds a single "Pro" Plan document with one active monthly price, then
 * loads it into the in-memory plan cache the webhook handler reads from
 * (resolvePlanFromPriceId) — mirrors what src/config/db.js's connectDB()
 * does at real boot, which testDb.js's connect() deliberately skips.
 */
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
         }
      ],
      isActive: true
   });
   await loadPlanCache();
};

const createUser = async (overrides = {}) =>
   User.create({
      username: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      email: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`,
      password: 'hashed_password_not_used_directly',
      isEmailVerified: true,
      ...overrides
   });

const postWebhook = (event) => {
   stripe.webhooks.constructEvent.mockReturnValue(event);
   return request(app)
      .post('/api/webhook')
      // Body content doesn't matter — constructEvent is mocked to return
      // `event` regardless of input. The route requires SOME raw body
      // and a stripe-signature header to reach that call at all.
      .set('stripe-signature', 'test-signature')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ id: event.id }));
};

const makeSubscription = (overrides = {}) => ({
   id: SUBSCRIPTION_ID,
   customer: CUSTOMER_ID,
   status: 'active',
   current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
   items: { data: [{ price: { id: PRICE_ID } }] },
   latest_invoice: 'in_test_123',
   ...overrides
});

describe('POST /api/webhook — signature verification', () => {
   it('rejects a request with an invalid/unverifiable signature', async () => {
      stripe.webhooks.constructEvent.mockImplementation(() => {
         throw new Error('No signatures found matching the expected signature for payload');
      });

      const res = await request(app)
         .post('/api/webhook')
         .set('stripe-signature', 'bad-signature')
         .set('Content-Type', 'application/json')
         .send(JSON.stringify({ foo: 'bar' }));

      expect(res.status).toBe(400);
      expect(res.text).toMatch(/Webhook Error/);
   });
});

describe('POST /api/webhook — event whitelist', () => {
   it('acknowledges but no-ops an event type that is not whitelisted', async () => {
      const res = await postWebhook({
         id: 'evt_unhandled_1',
         type: 'payment_intent.succeeded',
         data: { object: {} }
      });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ received: true });
   });
});

describe('POST /api/webhook — checkout.session.completed', () => {
   it('activates the plan and creates a Payment row on first checkout', async () => {
      await seedPlan();
      const user = await createUser();

      stripe.subscriptions.retrieve.mockResolvedValue(makeSubscription());

      const res = await postWebhook({
         id: 'evt_checkout_1',
         type: 'checkout.session.completed',
         data: {
            object: {
               id: 'cs_test_123',
               mode: 'subscription',
               customer: CUSTOMER_ID,
               subscription: SUBSCRIPTION_ID,
               amount_total: 999,
               currency: 'usd',
               metadata: { internalUserId: user._id.toString() }
            }
         }
      });

      expect(res.status).toBe(200);

      const updatedUser = await User.findById(user._id);
      expect(updatedUser.subscription.plan).toBe('pro');
      expect(updatedUser.subscription.status).toBe('active');
      expect(updatedUser.subscription.stripeCustomerId).toBe(CUSTOMER_ID);
      expect(updatedUser.subscription.stripeSubscriptionId).toBe(SUBSCRIPTION_ID);

      const payment = await Payment.findOne({ stripeSessionId: 'cs_test_123' });
      expect(payment).toBeTruthy();
      expect(payment.status).toBe('paid');
      expect(payment.plan).toBe('pro');
      expect(payment.amount).toBe(9.99);
   });

   it('ignores one-time (non-subscription) checkout sessions', async () => {
      await seedPlan();

      const res = await postWebhook({
         id: 'evt_checkout_onetime',
         type: 'checkout.session.completed',
         data: {
            object: { id: 'cs_test_onetime', mode: 'payment' }
         }
      });

      expect(res.status).toBe(200);
      expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
   });

   it('is idempotent — replaying the same event twice does not create a second Payment row', async () => {
      await seedPlan();
      const user = await createUser();
      stripe.subscriptions.retrieve.mockResolvedValue(makeSubscription());

      const event = {
         id: 'evt_checkout_replay',
         type: 'checkout.session.completed',
         data: {
            object: {
               id: 'cs_test_replay',
               mode: 'subscription',
               customer: CUSTOMER_ID,
               subscription: SUBSCRIPTION_ID,
               amount_total: 999,
               currency: 'usd',
               metadata: { internalUserId: user._id.toString() }
            }
         }
      };

      const first = await postWebhook(event);
      const second = await postWebhook(event);

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);

      const payments = await Payment.find({ stripeSessionId: 'cs_test_replay' });
      expect(payments).toHaveLength(1);

      const events = await WebhookEvent.find({ eventId: 'evt_checkout_replay' });
      expect(events).toHaveLength(1);
   });
});

describe('POST /api/webhook — invoice.payment_failed', () => {
   it('syncs the subscription status Stripe actually reports (e.g. past_due)', async () => {
      await seedPlan();
      const user = await createUser({
         subscription: {
            plan: 'pro',
            stripeCustomerId: CUSTOMER_ID,
            stripeSubscriptionId: SUBSCRIPTION_ID,
            status: 'active'
         }
      });

      stripe.subscriptions.retrieve.mockResolvedValue(
         makeSubscription({ status: 'past_due' })
      );

      const res = await postWebhook({
         id: 'evt_invoice_failed_1',
         type: 'invoice.payment_failed',
         data: {
            object: { subscription: SUBSCRIPTION_ID }
         }
      });

      expect(res.status).toBe(200);

      const updatedUser = await User.findById(user._id);
      expect(updatedUser.subscription.status).toBe('past_due');
   });
});

describe('POST /api/webhook — customer.subscription.deleted', () => {
   it('downgrades the user to the free plan', async () => {
      await seedPlan();
      const user = await createUser({
         subscription: {
            plan: 'pro',
            stripeCustomerId: CUSTOMER_ID,
            stripeSubscriptionId: SUBSCRIPTION_ID,
            status: 'active'
         }
      });

      const res = await postWebhook({
         id: 'evt_sub_deleted_1',
         type: 'customer.subscription.deleted',
         data: {
            object: { id: SUBSCRIPTION_ID }
         }
      });

      expect(res.status).toBe(200);

      const updatedUser = await User.findById(user._id);
      expect(updatedUser.subscription.plan).toBe('free');
      expect(updatedUser.subscription.status).toBe('canceled');
      expect(updatedUser.subscription.stripeSubscriptionId).toBeNull();
      // Customer ID is deliberately preserved — see payment.service.js's
      // downgradeToFree() comment.
      expect(updatedUser.subscription.stripeCustomerId).toBe(CUSTOMER_ID);
   });
});

describe('POST /api/webhook — invoice.paid', () => {
   it('creates a Payment row and syncs the subscription status on invoice payment', async () => {
      await seedPlan();
      const user = await createUser({
         subscription: {
            plan: 'pro',
            billingInterval: 'monthly',
            status: 'active',
            stripeCustomerId: CUSTOMER_ID,
            stripeSubscriptionId: SUBSCRIPTION_ID
         }
      });

      stripe.subscriptions.retrieve.mockResolvedValue(makeSubscription());

      const res = await postWebhook({
         id: 'evt_invoice_paid_1',
         type: 'invoice.paid',
         data: {
            object: {
               id: 'in_test_123',
               customer: CUSTOMER_ID,
               subscription: SUBSCRIPTION_ID,
               amount_paid: 999,
               currency: 'usd'
            }
         }
      });

      expect(res.status).toBe(200);

      const payment = await Payment.findOne({ invoiceId: 'in_test_123' });
      expect(payment).toBeTruthy();
      expect(payment.amount).toBe(9.99);
      expect(payment.status).toBe('paid');
      expect(payment.plan).toBe('pro');
      expect(payment.stripeCustomerId).toBe(CUSTOMER_ID);

      const updatedUser = await User.findById(user._id);
      expect(updatedUser.subscription.status).toBe('active');
      expect(updatedUser.subscription.plan).toBe('pro');
   });
});

describe('POST /api/webhook — customer.subscription.updated', () => {
   it('reconciles a free local user when Stripe reports an active subscription', async () => {
      await seedPlan();
      const user = await createUser({
         subscription: {
            plan: 'free',
            billingInterval: null,
            status: 'free',
            stripeCustomerId: CUSTOMER_ID,
            stripeSubscriptionId: null
         }
      });

      const activeSubscription = makeSubscription({
         metadata: { internalUserId: user._id.toString() }
      });

      const res = await postWebhook({
         id: 'evt_sub_updated_reconcile_free',
         type: 'customer.subscription.updated',
         data: { object: activeSubscription }
      });

      expect(res.status).toBe(200);

      const updatedUser = await User.findById(user._id);
      expect(updatedUser.subscription).toMatchObject({
         plan: 'pro',
         billingInterval: 'monthly',
         status: 'active',
         stripeCustomerId: CUSTOMER_ID,
         stripeSubscriptionId: SUBSCRIPTION_ID,
         stripePriceId: PRICE_ID
      });
   });

   it('syncs the updated subscription status and plan details', async () => {
      await seedPlan();
      const user = await createUser({
         subscription: {
            plan: 'pro',
            billingInterval: 'monthly',
            status: 'active',
            stripeCustomerId: CUSTOMER_ID,
            stripeSubscriptionId: SUBSCRIPTION_ID
         }
      });

      const updatedSubscription = makeSubscription({
         status: 'past_due',
         current_period_end: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
      });

      const res = await postWebhook({
         id: 'evt_sub_updated_1',
         type: 'customer.subscription.updated',
         data: {
            object: updatedSubscription
         }
      });

      expect(res.status).toBe(200);

      const updatedUser = await User.findById(user._id);
      expect(updatedUser.subscription.status).toBe('past_due');
      expect(updatedUser.subscription.plan).toBe('pro');
      expect(updatedUser.subscription.billingInterval).toBe('monthly');
   });
});

describe('POST /api/webhook — customer.deleted', () => {
   it('clears Stripe customer data and resets the user to free', async () => {
      await seedPlan();
      const user = await createUser({
         subscription: {
            plan: 'pro',
            billingInterval: 'monthly',
            status: 'active',
            stripeCustomerId: CUSTOMER_ID,
            stripeSubscriptionId: SUBSCRIPTION_ID
         }
      });

      const res = await postWebhook({
         id: 'evt_customer_deleted_1',
         type: 'customer.deleted',
         data: {
            object: { id: CUSTOMER_ID }
         }
      });

      expect(res.status).toBe(200);

      const updatedUser = await User.findById(user._id);
      expect(updatedUser.subscription.plan).toBe('free');
      expect(updatedUser.subscription.status).toBe('canceled');
      expect(updatedUser.subscription.stripeCustomerId).toBeNull();
      expect(updatedUser.subscription.stripeSubscriptionId).toBeNull();
   });
});
