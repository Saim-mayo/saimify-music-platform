// One-off cleanup: after wiping Stripe with cancelAllSubscriptions.js +
// deleteAllStripeCustomers.js, your Mongo user documents still point at
// Stripe IDs that no longer exist. This clears those local pointers so
// the app doesn't error out (e.g. "No such customer") the next time an
// affected user hits checkout or the billing page. Every user goes back
// to a clean "free / no customer" state, exactly like a brand-new
// signup — they'll get ONE fresh Stripe customer next time they check out.
//
// Run this LAST, after the two Stripe-side scripts.
//
// Usage:
//   node src/scripts/resetLocalSubscriptionLinks.js --dry-run
//   node src/scripts/resetLocalSubscriptionLinks.js
require('dotenv').config();
const mongoose = require('mongoose');
const env = require('../config/env');
const User = require('../models/user.model');
const dryRun = process.argv.includes('--dry-run');

async function main() {
  await mongoose.connect(env.MONGO_URI);

  const affected = await User.find({
    $or: [
      { 'subscription.stripeCustomerId': { $ne: null } },
      { 'subscription.stripeSubscriptionId': { $ne: null } }
    ]
  }).select('_id email subscription.stripeCustomerId subscription.stripeSubscriptionId');

  console.log(`Found ${affected.length} user(s) with a local Stripe link.`);
  for (const u of affected) {
    console.log(`- ${u.email} (customer: ${u.subscription?.stripeCustomerId}, sub: ${u.subscription?.stripeSubscriptionId})`);
  }

  if (dryRun) {
    console.log('\nDry run — nothing was changed. Re-run without --dry-run to apply.');
    await mongoose.disconnect();
    return;
  }

  const result = await User.updateMany(
    {
      $or: [
        { 'subscription.stripeCustomerId': { $ne: null } },
        { 'subscription.stripeSubscriptionId': { $ne: null } }
      ]
    },
    {
      $set: {
        'subscription.status': 'free',
        'subscription.stripeSubscriptionId': null
      },
      $unset: {
        'subscription.stripeCustomerId': ''
      }
    }
  );

  console.log(`\nDone. Reset ${result.modifiedCount} user(s).`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});