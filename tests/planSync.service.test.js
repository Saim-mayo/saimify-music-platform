const { connect, closeDatabase, clearDatabase } = require('./testDb');
const Plan = require('../src/models/plan.model');

const mockStripe = {
   products: {
      retrieve: jest.fn(),
      list: jest.fn()
   },
   prices: {
      retrieve: jest.fn(),
      list: jest.fn()
   }
};

jest.mock('../src/config/stripe', () => mockStripe);
jest.mock('../src/services/planCache.service', () => ({
   refreshPlanCache: jest.fn().mockResolvedValue(undefined)
}));

const {
   upsertProductFromStripe,
   syncPriceFromStripe,
   syncAllPricesForProduct,
   syncAllProductsFromStripe,
   deactivateProduct,
   deactivatePrice,
   recomputePlanLevels,
   resolvePlanKey,
   resolveInterval,
   parseFeatureMetadata
} = require('../src/services/planSync.service');

const { refreshPlanCache } = require('../src/services/planCache.service');

beforeAll(async () => {
   await connect();
});

afterEach(async () => {
   await clearDatabase();
   jest.clearAllMocks();
});

afterAll(async () => {
   await closeDatabase();
});

describe('planSync.service utility helpers', () => {
   it('resolves plan keys from explicit metadata, slugified names, and product IDs', () => {
      expect(resolvePlanKey({ metadata: { planKey: 'Pro ' }, id: 'prod_1', name: 'Ignored' })).toBe('pro');
      expect(resolvePlanKey({ metadata: {}, id: 'prod_123', name: 'Pro Plan!' })).toBe('pro-plan');
      expect(resolvePlanKey({ metadata: {}, id: 'prod_emoji', name: '😀' })).toBe('prod_emoji');
   });

   it('parses nullable integers, booleans, and feature metadata with safe fallbacks', () => {
      expect(parseFeatureMetadata({
         dailyPlayLimit: 'null',
         canDownload: 'yes',
         maxDownloads: 'unlimited',
         adFree: '1'
      })).toEqual({
         dailyPlayLimit: null,
         canDownload: true,
         maxDownloads: null,
         adFree: true
      });

      expect(parseFeatureMetadata({
         dailyPlayLimit: '123',
         canDownload: '',
         maxDownloads: '123',
         adFree: 'false'
      })).toEqual({
         dailyPlayLimit: 123,
         canDownload: false,
         maxDownloads: 123,
         adFree: false
      });

      expect(parseFeatureMetadata()).toEqual({
         dailyPlayLimit: null,
         canDownload: false,
         maxDownloads: 0,
         adFree: false
      });
   });

   it('resolves supported billing intervals and rejects unsupported recurring prices', () => {
      expect(resolveInterval({ recurring: { interval: 'month', interval_count: 1 } })).toBe('monthly');
      expect(resolveInterval({ recurring: { interval: 'year', interval_count: 1 } })).toBe('yearly');
      expect(resolveInterval({ recurring: { interval: 'week', interval_count: 1 } })).toBeNull();
      expect(resolveInterval({ recurring: null })).toBeNull();
   });
});

describe('planSync.service DB-backed sync flows', () => {
   it('recomputes plan levels, assigning ranks and clearing unranked entries', async () => {
      await Plan.create({
         planKey: 'pro',
         name: 'Pro',
         level: 99,
         stripeProductId: 'prod_pro',
         prices: [
            { stripePriceId: 'price_1', interval: 'monthly', amount: 999, currency: 'usd', active: true },
            { stripePriceId: 'price_2', interval: 'yearly', amount: 9990, currency: 'usd', active: true }
         ],
         isFree: false,
         isActive: true
      });

      await Plan.create({
         planKey: 'free',
         name: 'Free',
         level: 0,
         stripeProductId: 'prod_free',
         prices: [
            { stripePriceId: 'price_free', interval: 'monthly', amount: 0, currency: 'usd', active: true }
         ],
         isFree: true,
         isActive: true
      });

      await Plan.create({
         planKey: 'elite',
         name: 'Elite',
         level: 2,
         stripeProductId: 'prod_elite',
         prices: [
            { stripePriceId: 'price_3', interval: 'monthly', amount: 1499, currency: 'usd', active: false }
         ],
         isFree: false,
         isActive: true
      });

      await recomputePlanLevels();

      const [pro, elite] = await Promise.all([
         Plan.findOne({ planKey: 'pro' }).lean(),
         Plan.findOne({ planKey: 'elite' }).lean()
      ]);

      expect(pro.level).toBe(1);
      expect(elite.level).toBe(null);
   });

   it('upserts a Stripe product into Mongo and refreshes plan cache', async () => {
      mockStripe.products.retrieve.mockResolvedValue({
         id: 'prod_123',
         name: 'Pro Plan!',
         active: true,
         metadata: { dailyPlayLimit: '10', canDownload: 'true', maxDownloads: '5', adFree: 'true', planKey: 'PRO' }
      });

      const plan = await upsertProductFromStripe('prod_123');

      expect(plan.planKey).toBe('pro');
      expect(plan.features).toEqual({
         dailyPlayLimit: 10,
         canDownload: true,
         maxDownloads: 5,
         adFree: true
      });
      expect(refreshPlanCache).toHaveBeenCalledTimes(1);
   });

   it('syncs a single Stripe price into the correct plan, keeping the latest active interval', async () => {
      mockStripe.products.retrieve.mockResolvedValue({
         id: 'prod_123',
         name: 'Pro Plan',
         active: true,
         metadata: {}
      });

      mockStripe.prices.retrieve.mockResolvedValue({
         id: 'price_123',
         unit_amount: 1999,
         currency: 'usd',
         active: true,
         recurring: { interval: 'month', interval_count: 1 },
         product: 'prod_123'
      });

      await upsertProductFromStripe('prod_123');
      const plan = await syncPriceFromStripe('price_123');

      expect(plan.prices).toEqual([
         expect.objectContaining({ stripePriceId: 'price_123', interval: 'monthly', amount: 1999, active: true })
      ]);
      expect(refreshPlanCache).toHaveBeenCalled();
   });

   it('backs up and clears deactivation flows for deleted products and prices', async () => {
      await Plan.create({
         stripeProductId: 'prod_deleted',
         planKey: 'pro',
         name: 'Pro',
         isActive: true,
         prices: [{ stripePriceId: 'price_deleted', interval: 'monthly', amount: 999, currency: 'usd', active: true }],
         isFree: false
      });

      const deactivateProductResult = await deactivateProduct('prod_deleted');
      expect(deactivateProductResult.isActive).toBe(false);

      const deactivatePriceResult = await deactivatePrice('price_deleted');
      expect(deactivatePriceResult.prices[0].active).toBe(false);
      expect(refreshPlanCache).toHaveBeenCalled();
   });

   it('syncs all prices for a product and pages through all Stripe products', async () => {
      mockStripe.prices.list.mockResolvedValue({
         data: [
            { id: 'price_1', product: 'prod_1' },
            { id: 'price_2', product: 'prod_1' }
         ],
         has_more: false
      });

      mockStripe.products.list.mockResolvedValue({
         data: [
            { id: 'prod_1' },
            { id: 'prod_2' }
         ],
         has_more: false
      });

      mockStripe.products.retrieve.mockResolvedValue({
         id: 'prod_1',
         name: 'Pro Plan',
         active: true,
         metadata: {}
      });

      mockStripe.prices.retrieve.mockResolvedValue({
         id: 'price_1',
         unit_amount: 999,
         currency: 'usd',
         active: true,
         recurring: { interval: 'month', interval_count: 1 },
         product: 'prod_1'
      });

      const productResults = await syncAllProductsFromStripe();
      expect(productResults).toHaveLength(2);

      const priceResults = await syncAllPricesForProduct('prod_1');
      expect(priceResults).toEqual(['price_1', 'price_2']);
   });
});
