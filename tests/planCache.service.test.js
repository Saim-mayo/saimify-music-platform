const mockPlanFind = jest.fn();

jest.mock('../src/models/plan.model', () => ({
   find: mockPlanFind
}));

const {
   loadPlanCache,
   refreshPlanCache,
   getAllPlans,
   getPlan,
   resolvePriceId,
   resolvePlanFromPriceId,
   getCacheMeta
} = require('../src/services/planCache.service');

describe('planCache.service', () => {
   beforeEach(() => {
      jest.clearAllMocks();
   });

   it('loads and refreshes the in-memory cache from Mongo', async () => {
      mockPlanFind.mockReturnValue({ lean: jest.fn().mockResolvedValue([
         {
            planKey: 'pro',
            isActive: true,
            prices: [{ interval: 'monthly', stripePriceId: 'price_1', active: true }]
         },
         {
            planKey: 'free',
            isActive: true,
            prices: [{ interval: 'monthly', stripePriceId: 'price_free', active: true }]
         }
      ]) });

      const cache = await loadPlanCache();
      expect(cache.byPlanKey.size).toBe(2);
      expect(cache.byPriceId.size).toBe(2);
      expect(getPlan('pro')).toMatchObject({ planKey: 'pro' });
      expect(resolvePriceId('pro', 'monthly')).toBe('price_1');
      expect(resolvePlanFromPriceId('price_1')).toMatchObject({ planKey: 'pro' });
      expect(getAllPlans()).toHaveLength(2);

      const refreshed = await refreshPlanCache();
      expect(refreshed).toEqual(expect.objectContaining({ byPlanKey: expect.any(Map), byPriceId: expect.any(Map) }));
   });

   it('returns null for unresolved plan and price lookups and exposes cache metadata', async () => {
      mockPlanFind.mockReturnValue({ lean: jest.fn().mockResolvedValue([
         {
            planKey: 'pro',
            isActive: true,
            prices: [{ interval: 'monthly', stripePriceId: 'price_1', active: true }]
         }
      ]) });

      await loadPlanCache();
      expect(resolvePriceId('pro', 'yearly')).toBeNull();
      expect(resolvePriceId('missing', 'monthly')).toBeNull();
      expect(resolvePlanFromPriceId('missing')).toBeNull();
      expect(getCacheMeta()).toEqual(expect.objectContaining({ loadedAt: expect.any(Date), planCount: 1, priceCount: 1 }));
   });
});
