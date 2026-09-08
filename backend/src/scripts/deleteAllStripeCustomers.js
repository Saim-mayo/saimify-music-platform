// One-off cleanup: delete EVERY Stripe customer in the current Stripe
// key's mode (test or live — whatever STRIPE_SECRET_KEY points at).
//
// Run this AFTER cancelAllSubscriptions.js. It removes the Customer
// objects themselves — which is what's actually causing "6 or 7 Stripe
// IDs" to show up for one account: each test checkout that ran before
// (or outside) the atomic findOrCreateStripeCustomer guard created a
// new Customer object in Stripe. Canceling subscriptions alone does
// NOT remove those leftover Customer records — this script does.
//
// Usage:
//   node src/scripts/deleteAllStripeCustomers.js --dry-run   (list only)
//   node src/scripts/deleteAllStripeCustomers.js             (actually deletes)
require('dotenv').config();
const stripe = require('../config/stripe');
const dryRun = process.argv.includes('--dry-run');

async function main() {
  const toDelete = [];
  for await (const customer of stripe.customers.list({ limit: 100 })) {
    toDelete.push(customer);
  }

  console.log(`Found ${toDelete.length} customer(s).`);
  for (const c of toDelete) {
    console.log(`- ${c.id} (email: ${c.email || 'none'})`);
  }

  if (dryRun) {
    console.log('\nDry run — nothing was deleted. Re-run without --dry-run to apply.');
    return;
  }

  let deleted = 0;
  for (const c of toDelete) {
    try {
      await stripe.customers.del(c.id);
      console.log(`deleted ${c.id}`);
      deleted += 1;
    } catch (error) {
      console.error(`failed to delete ${c.id}:`, error.message);
    }
  }
  console.log(`\nDone. Deleted ${deleted}/${toDelete.length} customer(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});