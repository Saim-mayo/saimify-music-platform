const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/appError');

const {
   syncAllPricesForProduct,
   upsertProductFromStripe,
   syncAllProductsFromStripe
} = require('../services/planSync.service');
const { getAllPlans, getCacheMeta } = require('../services/planCache.service');

/**
 * Manual sync helpers for Stripe plan metadata and cache recovery.
 */
const getPlanCacheStatus = asyncHandler(async (req, res) => {

   return res.status(200).json({
      success: true,
      meta: getCacheMeta(),
      plans: getAllPlans()
   });
});

const resyncProduct = asyncHandler(async (req, res) => {

   const { stripeProductId } = req.body;

   if (!stripeProductId) {
      throw new AppError('stripeProductId is required', 400);
   }

   const plan = await upsertProductFromStripe(stripeProductId);
   const syncedPriceIds = await syncAllPricesForProduct(stripeProductId);

   return res.status(200).json({
      success: true,
      message: `Resynced product ${stripeProductId}`,
      planKey: plan.planKey,
      syncedPriceIds
   });
});

const resyncAllProducts = asyncHandler(async (req, res) => {

   const results = await syncAllProductsFromStripe();

   return res.status(200).json({
      success: true,
      message: `Resynced ${results.length} product(s)`,
      results
   });
});

module.exports = {
   getPlanCacheStatus,
   resyncProduct,
   resyncAllProducts
};
