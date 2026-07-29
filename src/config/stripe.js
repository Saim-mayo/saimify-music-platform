const Stripe = require('stripe');
const env = require('./env');
const stripe = new Stripe(
   env.STRIPE_SECRET_KEY
);

const maskSecret = (secret) => {
   if (!secret) return '(missing)';
   if (secret.length < 10) return '***';
   return `${secret.slice(0, 8)}...${secret.slice(-4)}`;
};

const keyMode = env.STRIPE_SECRET_KEY.match(/^(?:sk|rk)_(test|live)_/)?.[1] || 'unknown';

console.info(
   `[stripe] mode=${keyMode} secretKey=${maskSecret(env.STRIPE_SECRET_KEY)} webhookSecret=${maskSecret(env.STRIPE_WEBHOOK_SECRET)}`
);

module.exports = stripe;