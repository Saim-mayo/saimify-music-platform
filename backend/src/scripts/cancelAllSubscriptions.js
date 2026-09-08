// One-off cleanup: cancel EVERY non-canceled subscription in the current
// Stripe key's mode (test or live — whatever STRIPE_SECRET_KEY points at).
// Use this before deploy to clear out test-mode cruft, or any time you
// want to hard-reset billing state in a non-production environment.
//
// Usage:
//   node src/scripts/cancelAllSubscriptions.js --dry-run   (list only, cancels nothing)
//   node src/scripts/cancelAllSubscriptions.js             (actually cancels)
require('dotenv').config();
const stripe = require('../config/stripe');
const dryRun = process.argv.includes('--dry-run');
async function main() {
  const toCancel = [];
  for await (const subscription of stripe.subscriptions.list({ status: 'all', limit: 100 })) {
    if (subscription.status !== 'canceled') {
      toCancel.push(subscription);
    }
  }
  console.log(`Found ${toCancel.length} non-canceled subscription(s).`);
  for (const sub of toCancel) {
    console.log(`- ${sub.id} (customer: ${sub.customer}, status: ${sub.status})`);
  }
  if (dryRun) {
    console.log('\nDry run — nothing was canceled. Re-run without --dry-run to apply.');
    return;
  }
  for (const sub of toCancel) {
    try {
      await stripe.subscriptions.cancel(sub.id);
      console.log(`canceled ${sub.id}`);
    } catch (error) {
      console.error(`failed to cancel ${sub.id}:`, error.message);
    }
  }
  console.log(`\nDone. Canceled ${toCancel.length} subscription(s).`);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});