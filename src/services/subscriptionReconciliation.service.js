const stripe = require('../config/stripe');
const User = require('../models/user.model');
const { resolvePlanFromPriceId } = require('../config/plans');
const { setUserPlan } = require('./payment.service');

const getCurrentPeriodEnd = (subscription) =>
   subscription.current_period_end
   ?? subscription.items?.data?.[0]?.current_period_end
   ?? null;

const listAllSubscriptions = async (stripeClient = stripe) => {
   const subscriptions = [];

   for await (const subscription of stripeClient.subscriptions.list({
      status: 'all',
      limit: 100
   })) {
      subscriptions.push(subscription);
   }

   return subscriptions;
};

const reconcileSubscriptions = async ({ stripeClient = stripe, dryRun = false } = {}) => {
   const subscriptions = await listAllSubscriptions(stripeClient);
   const report = {
      scanned: subscriptions.length,
      matched: 0,
      updated: 0,
      mismatches: [],
      skipped: [],
      errors: []
   };

   for (const subscription of subscriptions) {
      const userId = subscription.metadata?.internalUserId;
      const priceId = subscription.items?.data?.[0]?.price?.id;
      const resolvedPlan = resolvePlanFromPriceId(priceId);

      if (!userId || !resolvedPlan) {
         report.skipped.push({
            subscriptionId: subscription.id,
            reason: !userId ? 'missing metadata.internalUserId' : `unrecognized price ${priceId}`
         });
         continue;
      }

      const user = await User.findById(userId).select('subscription');
      if (!user) {
         report.errors.push({ subscriptionId: subscription.id, reason: `user ${userId} not found` });
         continue;
      }

      report.matched += 1;
      const expectedStatus = subscription.status;
      const expectedExpiry = getCurrentPeriodEnd(subscription);
      const local = user.subscription || {};
      const mismatch = local.plan !== resolvedPlan.planKey
         || local.billingInterval !== resolvedPlan.interval
         || local.status !== expectedStatus
         || local.stripeSubscriptionId !== subscription.id
         || local.stripePriceId !== priceId;

      if (!mismatch) continue;

      report.mismatches.push({
         userId: user._id.toString(),
         subscriptionId: subscription.id,
         before: {
            plan: local.plan,
            billingInterval: local.billingInterval,
            status: local.status,
            stripeSubscriptionId: local.stripeSubscriptionId,
            stripePriceId: local.stripePriceId
         },
         after: {
            plan: resolvedPlan.planKey,
            billingInterval: resolvedPlan.interval,
            status: expectedStatus,
            stripeSubscriptionId: subscription.id,
            stripePriceId: priceId
         }
      });

      if (!dryRun) {
         await setUserPlan(
            {
               userId: user._id,
               stripeCustomerId: subscription.customer,
               stripeSubscriptionId: subscription.id
            },
            {
               plan: resolvedPlan.planKey,
               billingInterval: resolvedPlan.interval,
               stripePriceId: priceId,
               status: expectedStatus,
               expiresAt: expectedExpiry ? new Date(expectedExpiry * 1000) : null
            }
         );
         report.updated += 1;
      }
   }

   return report;
};

module.exports = {
   listAllSubscriptions,
   reconcileSubscriptions
};