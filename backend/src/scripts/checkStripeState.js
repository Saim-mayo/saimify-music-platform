// READ-ONLY diagnostic. Makes no changes to Stripe or Mongo.
// Run this FIRST, before any of the cleanup scripts, to see whether
// there's actually anything to clean up and how big the problem is.
//
// It answers three questions:
//   1. How many Stripe customers exist, and are any emails duplicated?
//   2. How many non-canceled subscriptions exist?
//   3. Of the Stripe customers, how many are actually linked to a user
//      in Mongo right now vs. orphaned (nothing points at them)?
//
// Usage:
//   node src/scripts/checkStripeState.js
require('dotenv').config();
const mongoose = require('mongoose');
const stripe = require('../config/stripe');
const env = require('../config/env');
const User = require('../models/user.model');

async function main() {
  await mongoose.connect(env.MONGO_URI);

  // --- Pull everything from Stripe ---
  const customers = [];
  for await (const c of stripe.customers.list({ limit: 100 })) {
    customers.push(c);
  }

  const subscriptions = [];
  for await (const s of stripe.subscriptions.list({ status: 'all', limit: 100 })) {
    subscriptions.push(s);
  }
  const activeSubs = subscriptions.filter((s) => s.status !== 'canceled');

  // --- Pull the linked side from Mongo ---
  const linkedUsers = await User.find({
    'subscription.stripeCustomerId': { $ne: null }
  }).select('email subscription.stripeCustomerId subscription.stripeSubscriptionId');

  const linkedCustomerIds = new Set(linkedUsers.map((u) => u.subscription.stripeCustomerId));

  // --- Group Stripe customers by email to spot duplicates ---
  const byEmail = new Map();
  for (const c of customers) {
    const key = c.email || '(no email)';
    if (!byEmail.has(key)) byEmail.set(key, []);
    byEmail.get(key).push(c.id);
  }
  const duplicateEmails = [...byEmail.entries()].filter(([, ids]) => ids.length > 1);

  console.log('=== Stripe ===');
  console.log(`Total customers: ${customers.length}`);
  console.log(`Total subscriptions: ${subscriptions.length} (${activeSubs.length} non-canceled)`);

  console.log('\n=== Mongo ===');
  console.log(`Users with a linked stripeCustomerId: ${linkedUsers.length}`);

  console.log('\n=== Duplicate check ===');
  if (duplicateEmails.length === 0) {
    console.log('No email has more than one Stripe customer.');
  } else {
    console.log(`${duplicateEmails.length} email(s) have multiple Stripe customers:`);
    for (const [email, ids] of duplicateEmails) {
      console.log(`- ${email}: ${ids.join(', ')}`);
    }
  }

  console.log('\n=== Orphan check ===');
  const orphans = customers.filter((c) => !linkedCustomerIds.has(c.id));
  if (orphans.length === 0) {
    console.log('Every Stripe customer is linked to a user in Mongo. Nothing orphaned.');
  } else {
    console.log(`${orphans.length} Stripe customer(s) are NOT linked to any user in Mongo:`);
    for (const c of orphans) {
      console.log(`- ${c.id} (email: ${c.email || 'none'})`);
    }
  }

  console.log('\n=== Verdict ===');
  if (duplicateEmails.length === 0 && orphans.length === 0 && activeSubs.length === 0) {
    console.log('Clean. No need to run the cleanup scripts.');
  } else {
    console.log('Issues found above — proceed with the cleanup scripts in order:');
    console.log('  1. cancelAllSubscriptions.js');
    console.log('  2. deleteAllStripeCustomers.js');
    console.log('  3. resetLocalSubscriptionLinks.js');
  }

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});