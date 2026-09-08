const crypto = require('crypto');
const OAuthExchangeCode = require('../models/oauthExchangeCode.model');

const CODE_TTL_MS = 60 * 1000; // 60 seconds
const HMAC_SECRET = process.env.OAUTH_EXCHANGE_SECRET || 'default_oauth_exchange_secret';

if (!process.env.OAUTH_EXCHANGE_SECRET) {
  console.warn('WARNING: OAUTH_EXCHANGE_SECRET is not configured. Use a strong secret in production.');
}

const hashCode = (raw) => {
  return crypto
    .createHmac('sha256', HMAC_SECRET)
    .update(raw)
    .digest('hex');
};

const createExchangeCode = async (userId) => {
  const rawCode = crypto.randomBytes(32).toString('hex');
  const codeHash = hashCode(rawCode);
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  await OAuthExchangeCode.create({ codeHash, userId, expiresAt });

  return rawCode;
};

const consumeExchangeCode = async (rawCode) => {
  if (!rawCode) return null;
  const codeHash = hashCode(rawCode);

  const record = await OAuthExchangeCode.findOneAndUpdate(
    { codeHash, used: false, expiresAt: { $gt: new Date() } },
    { $set: { used: true } },
    { new: false }
  );

  if (!record) return null;
  return record.userId;
};

module.exports = { createExchangeCode, consumeExchangeCode };
