const User = require('../src/models/user.model');
const { generateAccessToken } = require('../src/utils/token');

/**
 * Creates an already-verified user directly in the DB and returns a valid
 * access token + the Cookie header string for it, so route tests that
 * aren't specifically testing auth/registration don't have to go through
 * register -> verify-email -> login every time.
 */
const createAuthedUser = async (overrides = {}) => {
   const user = await User.create({
      username: overrides.username || `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      email: overrides.email || `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`,
      password: 'hashed_password_not_used_directly',
      role: overrides.role || 'user',
      isEmailVerified: true,
      ...overrides
   });

   const accessToken = generateAccessToken({
      _id: user._id,
      role: user.role,
      tokenVersion: user.tokenVersion
   });

   return {
      user,
      accessToken,
      cookie: `accessToken=${accessToken}`
   };
};

module.exports = { createAuthedUser };
