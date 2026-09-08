const mongoose = require('mongoose');

/**
 * =====================================
 * 👤 USER MODEL (SAAS ARCHITECTURE)
 * =====================================
 * WHY THIS STRUCTURE:
 * - supports normal users (listeners)
 * - supports artists (content creators)
 * - supports admin (platform control)
 * - supports subscriptions (premium system)
 */

const userSchema = new mongoose.Schema({

   // =========================
   // BASIC AUTH FIELDS
   // =========================
   username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
   },

   email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
   },

   password: {
      type: String,

      required: function () {
         return !this.googleId;
      },

      default: null,

      select: false
   },

   googleId: {

      type: String,

      default: null,

      index: true

   },

   provider: {

      type: String,

      enum: [

         'local',
         'google'

      ],

      default: 'local'

   },
   refreshToken: {
      type: String,
      default: null,
      select: false
   },
   // =========================
   // PASSWORD RESET (forgot/reset password flow)
   // =========================
   // Only the SHA-256 hash of the reset token is ever stored — the raw
   // token is emailed to the user once and never persisted, so a DB leak
   // alone can't be used to reset anyone's password.
   passwordResetTokenHash: {
      type: String,
      default: null,
      select: false
   },
   passwordResetExpires: {
      type: Date,
      default: null,
      select: false
   },
   // =========================
   // EMAIL VERIFICATION
   // =========================
   // Only the SHA-256 hash is stored, same pattern as passwordReset above.
   isEmailVerified: {
      type: Boolean,
      default: false
   },
   emailVerificationTokenHash: {
      type: String,
      default: null,
      select: false
   },
   emailVerificationExpires: {
      type: Date,
      default: null,
      select: false
   },
   // 🔒 Track token issue time (for future security)
   tokenVersion: {
      type: Number,
      default: 0
   },
   // =========================
   // ROLE SYSTEM (CORE ACCESS CONTROL)
   // =========================
   role: {
      type: String,
      enum: ['user', 'artist', 'admin'],
      default: 'user',
      index: true
   },


   /**
    * ⚠ IMPORTANT RULE:
    * role === "artist" alone is NOT enough
    * must also pass artistVerification.status === "approved"
    */

   // =========================
   // SUBSCRIPTION SYSTEM (PREMIUM FEATURES)
   // =========================
   subscription: {

      // Not a fixed enum: plan keys are Stripe-derived (see
      // config/plans.js / services/planSync.service.js), so the set of
      // valid values can grow/shrink from the Stripe Dashboard alone,
      // with no schema change here. 'free' is the only value guaranteed
      // to always exist, since it isn't billed through Stripe at all.
      plan: {
         type: String,
         lowercase: true,
         trim: true,
         default: 'free'
      },

      // Monthly vs yearly billing for the current plan.
      // null when plan === 'free'.
      billingInterval: {
         type: String,
         enum: ['monthly', 'yearly', null],
         default: null
      },

      // Mirrors Stripe Subscription `status` 1:1 (source of truth is
      // Stripe — see webhook.routes.js, which now writes whatever status
      // Stripe reports instead of hardcoding 'active'). 'free' and
      // 'expired' are the only two values that are LOCAL-only and never
      // come from Stripe: 'free' is the default for someone who never
      // subscribed, 'expired' is a local fallback set by
      // auth.middleware.js when expiresAt has passed and no fresher
      // webhook has landed yet.
      status: {
         type: String,
         enum: [
            'free',
            'incomplete',
            'incomplete_expired',
            'trialing',
            'active',
            'past_due',
            'canceled',
            'unpaid',
            'paused',
            'expired'
         ],
         default: 'free'
      },

      stripeCustomerId: {
         type: String,
         // NOTE: intentionally no `default: null` here. A sparse index
         // only skips documents where the field is truly absent — Mongo
         // treats an explicit `null` as a real, indexable value. With
         // `default: null`, every user got the field set to null at
         // creation, so the "sparse" unique index indexed all of them
         // under the same null key, and the second user ever created
         // hit `E11000 duplicate key ... stripeCustomerId: null`. Leaving
         // the field genuinely unset until a real Stripe customer ID is
         // assigned lets the sparse index correctly ignore users who
         // haven't checked out yet. The atomic query in
         // stripe.service.js (`{'subscription.stripeCustomerId': null}`)
         // is unaffected — Mongo's null-equality matches missing fields
         // the same way it matches an explicit null.
         // sparse unique: enforces "one Stripe Customer per user" at the
         // DB layer, not just in application code — a second concurrent
         // checkout request that raced past the app-level guard will
         // still fail here instead of silently creating a duplicate
         // customer and orphaning one of them.
         index: { unique: true, sparse: true }
      },

      stripeSubscriptionId: {
         type: String,
         default: null
      },

      // The exact Stripe price ID currently billing this user.
      // Kept alongside plan/interval so we can detect drift/debug fast.
      stripePriceId: {
         type: String,
         default: null
      },

      expiresAt: {
         type: Date,
         default: null
      }

   },

   /**
    * 💡 FUTURE USAGE:
    * - restrict downloads
    * - remove ads
    * - allow unlimited streaming
    */

   // =========================
   // ARTIST VERIFICATION SYSTEM (SAAS CORE FEATURE)
   // =========================
   artistVerification: {
      isVerified: {
         type: Boolean,
         default: false
      },

      status: {
         type: String,
         enum: ['none', 'pending', 'approved', 'rejected'],
         default: 'none'
      },

      documents: {
         idCard: String,
         proof: String
      }
   },

   /**
    * 📌 FLOW:
    * user → requests artist
    * admin → sets status: pending → approved/rejected
    * system → allows upload ONLY if approved
    */

   artistRequestAt: {
      type: Date,
      default: null
   },
   dailyUsage: {
      date: { type: String },
      plays: { type: Number, default: 0 }
   },
   isBanned: {
      type: Boolean,
      default: false
   },
   banReason: {
      type: String,
      default: null,
      trim: true
   },
   bannedAt: {
      type: Date,
      default: null
   },
   // user.model.js — inside userSchema
   lastLoginAt: {
      type: Date,
      default: null
   },
   // Device tracking for login notifications (only notify on new device)
   loginDevices: [
      {
         deviceFingerprint: {
            type: String,
            required: true,
            unique: false
         },
         userAgent: String,
         lastLoginAt: Date,
         createdAt: {
            type: Date,
            default: Date.now
         }
      }
   ],
   // =========================
   // PROFILE DATA
   // =========================
   bio: {
      type: String,
      default: '',
      maxlength: [500, 'Bio cannot exceed 500 characters']
   },

   avatar: {
      type: String,
      default: ''
   }

}, { timestamps: true });
userSchema.index({
   role: 1,
   'artistVerification.status': 1
});
module.exports = mongoose.model('User', userSchema);