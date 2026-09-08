// models/refreshToken.model.js
const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema({
  tokenHash: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  family: {
    // All tokens in the same login chain share a family ID
    type: String,
    required: true,
    index: true,
  },
  used: {
    // Once consumed to generate a new token, mark as used (not deleted yet)
    type: Boolean,
    default: false,
  },
  usedAt: {
    type: Date,
    default: null,
  },
  replacementHash: {
    type: String,
    default: null,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 }, // TTL auto-cleanup
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
