const express = require('express');

const router = express.Router();

const authMiddleware = require('../middlewares/auth.middleware');

const {
   paymentLimiter
} = require('../middlewares/rateLimit.middleware');

const {
   listPlans,
   createPaymentSession,
   changePlan,
   getSubscriptionStatus,
   getPaymentHistory,
   openBillingPortal,
   cancelSubscription,
   resumeSubscription
} = require('../controllers/payment.controller');

// =====================
// LIST PLANS (public)
// =====================

/**
 * @openapi
 * /payment/plans:
 *   get:
 *     summary: List available subscription plans (public, no secrets)
 *     tags: [Payment]
 *     responses:
 *       200: { description: Plan catalog (key, name, level, features) }
 */
router.get(
   '/plans',
   listPlans
);

// =====================
// CHECKOUT
// =====================

/**
 * @openapi
 * /payment/checkout:
 *   post:
 *     summary: Create a Stripe Checkout session for a new subscription
 *     tags: [Payment]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [planKey, interval]
 *             properties:
 *               planKey: { type: string, example: pro }
 *               interval: { type: string, enum: [monthly, yearly] }
 *     responses:
 *       200: { description: Stripe Checkout session URL }
 *       400: { description: Invalid plan/interval, or already has an active subscription }
 */
router.post(
   '/checkout',
   paymentLimiter,
   authMiddleware,
   createPaymentSession
);

// =====================
// CHANGE PLAN (upgrade/downgrade)
// =====================

/**
 * @openapi
 * /payment/change-plan:
 *   post:
 *     summary: Upgrade or downgrade an existing subscription (prorated via Stripe)
 *     tags: [Payment]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [planKey, interval]
 *             properties:
 *               planKey: { type: string }
 *               interval: { type: string, enum: [monthly, yearly] }
 *     responses:
 *       200: { description: Plan changed (direction is upgrade or downgrade) }
 *       400: { description: No active subscription to change }
 *       409: { description: Already subscribed to this plan/interval }
 */
router.post(
   '/change-plan',
   paymentLimiter,
   authMiddleware,
   changePlan
);

// =====================
// SUBSCRIPTION STATUS
// =====================

/**
 * @openapi
 * /payment/subscription/status:
 *   get:
 *     summary: Get the current user's subscription status
 *     tags: [Payment]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     responses:
 *       200: { description: Current subscription object }
 */
router.get(
   '/subscription/status',
   authMiddleware,
   getSubscriptionStatus
);

// =====================
// PAYMENT HISTORY
// =====================

/**
 * @openapi
 * /payment/history:
 *   get:
 *     summary: Get the current user's payment history
 *     tags: [Payment]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     responses:
 *       200: { description: List of past payments, most recent first }
 */
router.get(
   '/history',
   authMiddleware,
   getPaymentHistory
);

// =====================
// STRIPE BILLING PORTAL
// =====================

/**
 * @openapi
 * /payment/billing-portal:
 *   post:
 *     summary: Create a Stripe Billing Portal session (manage payment method, invoices, cancel)
 *     tags: [Payment]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     responses:
 *       200: { description: Billing portal session URL }
 *       400: { description: No Stripe customer found for this account }
 */
router.post(
   '/billing-portal',
   authMiddleware,
   openBillingPortal
);

// =====================
// CANCEL SUBSCRIPTION
// =====================

/**
 * @openapi
 * /payment/subscription:
 *   delete:
 *     summary: Cancel the current subscription (immediately or at period end)
 *     tags: [Payment]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               atPeriodEnd:
 *                 type: boolean
 *                 default: false
 *                 description: If true, access continues until the current period ends instead of stopping immediately.
 *     responses:
 *       200: { description: Cancellation confirmed (message reflects immediate vs. at-period-end) }
 *       400: { description: No active subscription found }
 */
router.delete(
   '/subscription',
   paymentLimiter,
   authMiddleware,
   cancelSubscription
);

// =====================
// RESUME (undo scheduled cancel_at_period_end)
// =====================

/**
 * @openapi
 * /payment/subscription/resume:
 *   post:
 *     summary: Undo a scheduled cancel_at_period_end, so the subscription keeps renewing
 *     tags: [Payment]
 *     security: [{ cookieAuth: [] }, { bearerAuth: [] }]
 *     responses:
 *       200: { description: Scheduled cancellation removed }
 *       400: { description: No subscription to resume }
 */
router.post(
   '/subscription/resume',
   paymentLimiter,
   authMiddleware,
   resumeSubscription
);

module.exports = router;
