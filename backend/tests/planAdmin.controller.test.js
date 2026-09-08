const mockSyncAllPricesForProduct = jest.fn();
const mockUpsertProductFromStripe = jest.fn();
const mockSyncAllProductsFromStripe = jest.fn();
const mockGetAllPlans = jest.fn();
const mockGetCacheMeta = jest.fn();

jest.mock('../src/services/planSync.service', () => ({
   syncAllPricesForProduct: mockSyncAllPricesForProduct,
   upsertProductFromStripe: mockUpsertProductFromStripe,
   syncAllProductsFromStripe: mockSyncAllProductsFromStripe
}));

jest.mock('../src/services/planCache.service', () => ({
   getAllPlans: mockGetAllPlans,
   getCacheMeta: mockGetCacheMeta
}));

const controller = require('../src/controllers/planAdmin.controller');

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

describe('planAdmin.controller', () => {
   beforeEach(() => {
      jest.clearAllMocks();
   });

   it('returns the cached plan catalog metadata and list', async () => {
      mockGetCacheMeta.mockReturnValue({ loadedAt: 'now', planCount: 2, priceCount: 3 });
      mockGetAllPlans.mockReturnValue([{ planKey: 'pro' }]);
      const req = {};
      const res = createResponse();
      const next = jest.fn();

      controller.getPlanCacheStatus(req, res, next);
      await flush();

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
         success: true,
         meta: { loadedAt: 'now', planCount: 2, priceCount: 3 },
         plans: [{ planKey: 'pro' }]
      });
      expect(next).not.toHaveBeenCalled();
   });

   it('rejects resyncProduct when stripeProductId is missing', async () => {
      const req = { body: {} };
      const res = createResponse();
      const next = jest.fn();

      controller.resyncProduct(req, res, next);
      await flush();

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400, message: 'stripeProductId is required' }));
   });

   it('resyncs a single product and returns the sync results', async () => {
      mockUpsertProductFromStripe.mockResolvedValue({ planKey: 'pro' });
      mockSyncAllPricesForProduct.mockResolvedValue(['price_1', 'price_2']);

      const req = { body: { stripeProductId: 'prod_123' } };
      const res = createResponse();
      const next = jest.fn();

      controller.resyncProduct(req, res, next);
      await flush();

      expect(mockUpsertProductFromStripe).toHaveBeenCalledWith('prod_123');
      expect(mockSyncAllPricesForProduct).toHaveBeenCalledWith('prod_123');
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
         success: true,
         message: 'Resynced product prod_123',
         planKey: 'pro',
         syncedPriceIds: ['price_1', 'price_2']
      });
      expect(next).not.toHaveBeenCalled();
   });

   it('resyncs all products from Stripe', async () => {
      mockSyncAllProductsFromStripe.mockResolvedValue([{ planKey: 'pro' }]);

      const req = {};
      const res = createResponse();
      const next = jest.fn();

      controller.resyncAllProducts(req, res, next);
      await flush();

      expect(mockSyncAllProductsFromStripe).toHaveBeenCalledTimes(1);
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
         success: true,
         message: 'Resynced 1 product(s)',
         results: [{ planKey: 'pro' }]
      });
      expect(next).not.toHaveBeenCalled();
   });
});
