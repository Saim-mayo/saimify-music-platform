const asyncHandler = require('../utils/asyncHandler');

const Payment = require('../models/payment.model');
const User = require('../models/user.model');

const AppError = require('../utils/appError');

const { getPlans, resolvePriceId, resolvePlanFromPriceId, isDowngrade } =
   require('../config/plans');
// NOTE: call getPlans() fresh at each use rather than destructuring PLANS
// once — PLANS is a getter over live cache data, so destructuring it here
// at require time would freeze a snapshot from server boot and never see
// later Stripe-synced price/plan changes.

const { isEntitled } = require('../utils/accessControl');
const { setUserPlan } = require('../services/payment.service');

const getSubscriptionIdForUser = async (user, userId) => {
   if (user?.subscription?.stripeSubscriptionId) {
      return user.subscription.stripeSubscriptionId;
   }

   const latestPayment = await Payment.findOne({ userId }).sort({ createdAt: -1 }).select('stripeSubscriptionId');
   return latestPayment?.stripeSubscriptionId || null;
};

const ACTIONABLE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing', 'past_due', 'unpaid', 'paused']);

const isActionableSubscriptionStatus = (status) => ACTIONABLE_SUBSCRIPTION_STATUSES.has(String(status || '').toLowerCase());

const isMissingStripeSubscriptionError = (error) => {
   const message = String(error?.message || error || '').toLowerCase();
   return message.includes('no such subscription')
      || message.includes('subscription not found')
      || message.includes('resource missing')
      || message.includes('404');
};

const getSubscriptionContext = async (user, userId) => {
   const subscriptionId = await getSubscriptionIdForUser(user, userId);
   let remoteStatus = '';
   let remoteLookupError = null;
   let remoteSubscription = null;

   if (subscriptionId) {
      try {
         remoteSubscription = await getSubscription(subscriptionId);
         remoteStatus = String(remoteSubscription?.status || '').toLowerCase();
      } catch (error) {
         remoteLookupError = error;
      }
   }

   return {
      subscriptionId,
      remoteStatus,
      remoteLookupError,
      remoteSubscription,
      isActionable: isActionableSubscriptionStatus(remoteStatus)
   };
};

const clearStaleSubscription = async (user) => {
   await setUserPlan(
      {
         userId: user._id,
         stripeCustomerId: user.subscription?.stripeCustomerId,
         stripeSubscriptionId: null
      },
      {
         plan: 'free',
         billingInterval: null,
         stripePriceId: null,
         status: 'canceled',
         expiresAt: null
      }
   ).catch(() => {});
};

const {
   createCheckoutSession,
   changeSubscriptionPlan,
   cancelStripeSubscription,
   resumeStripeSubscription,
   createBillingPortal,
   getSubscription,
   getCustomerSubscriptions
} = require('../services/stripe.service');

// ===========================
// LIST PLANS (public — no price IDs or secrets, just display data)
// ===========================
const listPlans = asyncHandler(async (req, res) => {

   const publicPlans = Object.values(getPlans()).map((p) => ({
      key: p.key,
      name: p.name,
      level: p.level,
      features: p.features,
      prices: p.prices || [],
      price: p.prices?.find((price) => price.interval === 'monthly')?.amount ?? null,
      currency: p.prices?.find((price) => price.interval === 'monthly')?.currency ?? null
   }));

   return res.status(200).json({
      success: true,
      plans: publicPlans
   });
});

// ===========================
// CREATE CHECKOUT SESSION
// ===========================
const createPaymentSession = asyncHandler(async (req, res) => {

   const { planKey, interval } = req.body;

   if (!planKey || !getPlans()[planKey]) {
      throw new AppError('Invalid plan', 400);
   }

   if (!['monthly', 'yearly'].includes(interval)) {
      throw new AppError('Invalid billing interval', 400);
   }

   const user = await User.findById(req.user.userId);

   if (!user) {
      throw new AppError('User not found', 404);
   }

   if (user.isBanned) {
      throw new AppError('Account banned', 403);
   }

   const { subscriptionId, remoteStatus, remoteLookupError } = await getSubscriptionContext(user, req.user.userId);
   const customerId = user.subscription?.stripeCustomerId;
   let hasCustomerActionableState = false;

   if (!subscriptionId && customerId) {
      const customerSubscriptions = await getCustomerSubscriptions(customerId) || [];
      hasCustomerActionableState = customerSubscriptions.some((subscription) =>
         isActionableSubscriptionStatus(subscription?.status)
      );
   }

   const isLocallyEntitled = user.subscription?.plan !== 'free' && isEntitled(user.subscription);
   const hasRemoteActionableState = Boolean(subscriptionId) && !remoteLookupError && isActionableSubscriptionStatus(remoteStatus);
   const hasRemoteCancellationEvidence = Boolean(subscriptionId) && (
      (remoteLookupError && isMissingStripeSubscriptionError(remoteLookupError))
      || (!remoteLookupError && !isActionableSubscriptionStatus(remoteStatus) && Boolean(remoteStatus))
   );

   // Allow checkout recovery when the user has local entitlement state but
   // no live Stripe subscription object yet, or when Stripe has already
   // indicated the old subscription is missing/canceled. In those cases,
   // a fresh checkout is the right path rather than forcing the user into
   // a plan change flow that cannot succeed.
   const shouldBlockCheckout = hasRemoteActionableState || hasCustomerActionableState || (
      isLocallyEntitled && Boolean(subscriptionId) && !hasRemoteCancellationEvidence
   );

   if (shouldBlockCheckout) {
      throw new AppError(
         'You already have an active subscription. Use change-plan to switch tiers.',
         400
      );
   }

   const session = await createCheckoutSession(user, planKey, interval);

   return res.status(200).json({
      success: true,
      url: session.url
   });
});

// ===========================
// CHANGE PLAN (upgrade or downgrade an existing subscription)
// ===========================
const changePlan = asyncHandler(async (req, res) => {

   const { planKey, interval } = req.body;

   if (!planKey || !getPlans()[planKey]) {
      throw new AppError('Invalid plan', 400);
   }

   if (!['monthly', 'yearly'].includes(interval)) {
      throw new AppError('Invalid billing interval', 400);
   }

   const user = await User.findById(req.user.userId);

   if (!user) {
      throw new AppError('User not found', 404);
   }

   if (user.isBanned) {
      throw new AppError('Account banned', 403);
   }

   const { subscriptionId, remoteStatus, remoteLookupError } = await getSubscriptionContext(user, req.user.userId);
   const localStatus = String(user.subscription?.status || '').toLowerCase();
   const isSubscriptionActionable = isActionableSubscriptionStatus(localStatus);
   const hasRemoteCancellationEvidence = Boolean(subscriptionId) && (
      (remoteLookupError && isMissingStripeSubscriptionError(remoteLookupError))
      || (!remoteLookupError && !isActionableSubscriptionStatus(remoteStatus) && Boolean(remoteStatus))
   );
   const hasRemoteActionableState = Boolean(subscriptionId) && !remoteLookupError && isActionableSubscriptionStatus(remoteStatus);

   const shouldAllowPlanChange = Boolean(subscriptionId)
      && isSubscriptionActionable
      && !hasRemoteCancellationEvidence
      && (!remoteStatus || hasRemoteActionableState);

   if (!shouldAllowPlanChange) {
      throw new AppError(
         'Your current subscription is inactive or canceled. Use checkout to start a new subscription.',
         400,
         { requiresCheckout: true }
      );
   }

   const newPriceId = resolvePriceId(planKey, interval);

   if (!newPriceId) {
      throw new AppError('Invalid plan or billing interval', 400);
   }

   const direction = isDowngrade(user.subscription.plan, planKey)
      ? 'downgrade'
      : 'upgrade';

   const currentPlan = getPlans()[user.subscription.plan] || getPlans().free;
   const targetPlan = getPlans()[planKey];
   const currentInterval = user.subscription.billingInterval || interval;
   const currentPrice = currentPlan?.prices?.find((price) => price.interval === currentInterval);
   const targetPrice = targetPlan?.prices?.find((price) => price.interval === interval);

   let pricingSummary = null;

   if (currentPrice && targetPrice) {
      const deltaAmount = direction === 'upgrade'
         ? targetPrice.amount - currentPrice.amount
         : currentPrice.amount - targetPrice.amount;

      pricingSummary = {
         direction,
         effect: direction === 'upgrade' ? 'charge' : 'credit',
         deltaAmount: Math.max(deltaAmount, 0),
         currency: targetPrice.currency || currentPrice.currency || 'usd'
      };
   }

   // The Stripe update triggers customer.subscription.updated, which is
   // what actually writes the new plan to the DB — this endpoint just
   // kicks it off and reports back what will happen.
   let result;
   try {
      result = await changeSubscriptionPlan(
         subscriptionId,
         newPriceId
      );
   } catch (error) {
      const message = error?.message || '';
      if (/canceled subscription|cancellation_details|metadata/i.test(message) || isMissingStripeSubscriptionError(error)) {
         throw new AppError(
            'Your subscription is already canceled. Start a new plan to reactivate access.',
            400,
            { requiresCheckout: true }
         );
      }
      throw error;
   }

   if (!result.changed) {
      throw new AppError(
         `You are already subscribed to the ${planKey} (${interval}) plan.`,
         409
      );
   }

   const updatedSubscription = result.subscription;
   const expiresAt = updatedSubscription?.current_period_end
      ? new Date(updatedSubscription.current_period_end * 1000)
      : null;

   await setUserPlan(
      {
         userId: user._id,
         stripeCustomerId: user.subscription?.stripeCustomerId || updatedSubscription?.customer,
         stripeSubscriptionId: subscriptionId
      },
      {
         plan: planKey,
         billingInterval: interval,
         stripePriceId: newPriceId,
         status: updatedSubscription?.status || 'active',
         expiresAt
      }
   );

   const message = direction === 'upgrade'
      ? 'Plan upgraded. You were charged a prorated amount immediately.'
      : 'Plan downgraded. A prorated credit was applied to your account.';

   return res.status(200).json({
      success: true,
      direction,
      pricingSummary,
      message
   });
});
   // ===========================
   // GET SUBSCRIPTION STATUS
   // ===========================
   const getSubscriptionStatus = asyncHandler(async (req, res) => {

      const user = await User.findById(req.user.userId)
         .select('subscription isBanned');

      if (!user) {
         throw new AppError('User not found', 404);
      }

      if (user.isBanned) {
         throw new AppError('Account banned', 403);
      }

      const context = await getSubscriptionContext(user, req.user.userId);
      const hasMissingRemoteSubscription = context.remoteLookupError && isMissingStripeSubscriptionError(context.remoteLookupError);
      const hasInactiveRemoteSubscription = context.remoteStatus && !isActionableSubscriptionStatus(context.remoteStatus);

      if (hasMissingRemoteSubscription || hasInactiveRemoteSubscription) {
         await clearStaleSubscription(user);
         return res.status(200).json({
            success: true,
            subscription: {
               ...user.subscription.toObject(),
               plan: 'free',
               billingInterval: null,
               status: 'canceled',
               stripeSubscriptionId: null,
               stripePriceId: null,
               expiresAt: null,
               cancelAtPeriodEnd: false
            }
         });
      }

      let subscription = user.subscription.toObject();

      if (context.remoteSubscription && isActionableSubscriptionStatus(context.remoteStatus)) {
         const remotePriceId = context.remoteSubscription.items?.data?.[0]?.price?.id;
         const resolvedPlan = resolvePlanFromPriceId(remotePriceId);

         if (resolvedPlan && (
            subscription.plan !== resolvedPlan.planKey
            || subscription.billingInterval !== resolvedPlan.interval
            || subscription.stripeSubscriptionId !== context.subscriptionId
         )) {
            const currentPeriodEnd = context.remoteSubscription.current_period_end
               ?? context.remoteSubscription.items?.data?.[0]?.current_period_end
               ?? null;
            const syncedUser = await setUserPlan(
               {
                  userId: user._id,
                  stripeCustomerId: context.remoteSubscription.customer || subscription.stripeCustomerId,
                  stripeSubscriptionId: context.subscriptionId
               },
               {
                  plan: resolvedPlan.planKey,
                  billingInterval: resolvedPlan.interval,
                  stripePriceId: remotePriceId,
                  status: context.remoteStatus,
                  expiresAt: currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null
               }
            );
            subscription = syncedUser.subscription.toObject();
         }
      }

      subscription.cancelAtPeriodEnd = Boolean(context.remoteSubscription?.cancel_at_period_end);

      return res.status(200).json({
         success: true,
         subscription
      });
   });

   // ===========================
   // PAYMENT HISTORY
   // ===========================
   const getPaymentHistory = asyncHandler(async (req, res) => {

      const payments = await Payment.find({
         userId: req.user.userId
      }).sort({
         createdAt: -1
      });

      return res.status(200).json({
         success: true,
         payments
      });
   });

   // ===========================
   // OPEN BILLING PORTAL
   // ===========================
   const openBillingPortal = asyncHandler(async (req, res) => {

      const user = await User.findById(req.user.userId);

      if (!user) {
         throw new AppError('User not found', 404);
      }

      if (user.isBanned) {
         throw new AppError('Account banned', 403);
      }

      let customerId = user.subscription?.stripeCustomerId;

      if (!customerId) {

         const latestPayment = await Payment.findOne({
            userId: req.user.userId
         }).sort({
            createdAt: -1
         });

         customerId = latestPayment?.stripeCustomerId;
      }

      if (!customerId) {
         throw new AppError('No Stripe customer found', 400);
      }

      const session = await createBillingPortal(customerId);

      return res.status(200).json({
         success: true,
         url: session.url
      });
   });

   // ===========================
   // CANCEL SUBSCRIPTION
   // ===========================
   // Body: { atPeriodEnd?: boolean } — defaults to false (immediate
   // cancel, matching the previous behavior) for backward compatibility.
   // Pass atPeriodEnd: true for the far more common "cancel my plan but
   // let me keep access until it runs out" UX.
   const cancelSubscription = asyncHandler(async (req, res) => {

      const { atPeriodEnd = false } = req.body || {};

      const user = await User.findById(req.user.userId);

      if (!user) {
         throw new AppError('User not found', 404);
      }

      if (user.isBanned) {
         throw new AppError('Account banned', 403);
      }

      const subscriptionId = await getSubscriptionIdForUser(user, req.user.userId);

      if (!subscriptionId) {
         return res.status(200).json({
            success: true,
            message: 'No active subscription found. Your account is already on the free plan.'
         });
      }

         const context = await getSubscriptionContext(user, req.user.userId);
         const hasMissingRemoteSubscription = context.remoteLookupError && isMissingStripeSubscriptionError(context.remoteLookupError);
         const hasInactiveRemoteSubscription = context.remoteStatus && !isActionableSubscriptionStatus(context.remoteStatus);

         if (hasMissingRemoteSubscription || hasInactiveRemoteSubscription) {
            await clearStaleSubscription(user);
            return res.status(200).json({
               success: true,
               message: 'Subscription was already canceled or is no longer active.'
            });
         }

      // Either path writes to Stripe only. The webhook
      // (customer.subscription.updated for scheduled cancellation,
      // customer.subscription.deleted for immediate) is what actually
      // updates the DB — this endpoint keeps Stripe the single source
      // of truth rather than writing local state directly.
      try {
         await cancelStripeSubscription(subscriptionId, { atPeriodEnd });
      } catch (error) {
         if (isMissingStripeSubscriptionError(error)) {
            await clearStaleSubscription(user);

            return res.status(200).json({
               success: true,
               message: 'Subscription was already canceled or is no longer active.'
            });
         }

         throw error;
      }

      return res.status(200).json({
         success: true,
         message: atPeriodEnd
            ? 'Subscription will cancel at the end of the current billing period. Access continues until then.'
            : 'Subscription cancelled. Access has ended immediately.'
      });
   });

   // ===========================
   // RESUME SUBSCRIPTION (undo a scheduled cancel_at_period_end)
   // ===========================
   const resumeSubscription = asyncHandler(async (req, res) => {

      const user = await User.findById(req.user.userId);

      if (!user) {
         throw new AppError('User not found', 404);
      }

      if (user.isBanned) {
         throw new AppError('Account banned', 403);
      }

      const { subscriptionId, remoteStatus, remoteLookupError, remoteSubscription } =
         await getSubscriptionContext(user, req.user.userId);

      if (!subscriptionId) {
         throw new AppError(
            'No active subscription to resume. Choose a plan to start a new subscription.',
            400,
            { requiresCheckout: true }
         );
      }

      if (remoteLookupError && isMissingStripeSubscriptionError(remoteLookupError)) {
         await clearStaleSubscription(user);
         throw new AppError(
            'This subscription no longer exists. Choose a plan to start a new subscription.',
            400,
            { requiresCheckout: true }
         );
      }

      if (!isActionableSubscriptionStatus(remoteStatus) || remoteStatus === 'canceled') {
         await clearStaleSubscription(user);
         throw new AppError(
            'This subscription is canceled. Choose a plan to start a new subscription.',
            400,
            { requiresCheckout: true }
         );
      }

      if (!remoteSubscription?.cancel_at_period_end) {
         throw new AppError('This subscription is not scheduled for cancellation.', 409);
      }

      await resumeStripeSubscription(subscriptionId);

      return res.status(200).json({
         success: true,
         message: 'Scheduled cancellation removed — your subscription will continue renewing.'
      });
   });

   module.exports = {
      listPlans,
      createPaymentSession,
      changePlan,
      getSubscriptionStatus,
      getPaymentHistory,
      openBillingPortal,
      cancelSubscription,
      resumeSubscription
   };


