const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const env = require('../config/env');
const logger = require('./logger');
const User = require('../models/user.model');

passport.use(
   new GoogleStrategy(
      {
         clientID: env.GOOGLE_CLIENT_ID,
         clientSecret: env.GOOGLE_CLIENT_SECRET,
         callbackURL: env.GOOGLE_CALLBACK_URL
      },
      async (accessToken, refreshToken, profile, done) => {
         try {
            // ==========================
            // EMAIL SAFETY CHECK
            // ==========================
            const email = profile?.emails?.[0]?.value
               ?.trim()
               ?.toLowerCase();

            if (!email) {
               return done(
                  new Error('Google account has no email'),
                  null
               );
            }

            // 🔒 SECURITY
            if (
               profile._json &&
               profile._json.email_verified === false
            ) {
               return done(
                  new Error('Google email not verified'),
                  null
               );
            }

            // ==========================
            // FIND USER BY EMAIL
            // ==========================
            let user = await User.findOne({ email });

            // ==========================
            // EXISTING USER
            // MERGE GOOGLE ACCOUNT
            // ==========================
            if (user) {
               // Prevent mismatched Google linking
               if (
                  user.googleId &&
                  user.googleId !== profile.id
               ) {
                  return done(
                     new Error('Google account mismatch'),
                     null
                  );
               }

               // First Google login for local account
               if (!user.googleId) {
                  user.googleId = profile.id;
               }

               // Google has already verified this email address, so an
               // existing local account linking Google no longer needs
               // to go through our own verification flow either.
               if (!user.isEmailVerified) {
                  user.isEmailVerified = true;
               }

               // Save avatar only if empty
               if (
                  !user.avatar &&
                  profile.photos?.[0]?.value
               ) {
                  user.avatar = profile.photos[0].value;
               }

               await user.save();

               return done(null, user);
            }

            const baseUsername = (
               profile.displayName ||
               email.split('@')[0]
            )
               .replace(/\s+/g, '')
               .toLowerCase()
               .slice(0, 20);

            let username = baseUsername;
            let counter = 1;
            let userCreated = false;
            let attempts = 0;
            const maxAttempts = 15;

            // Attempt to write directly to the DB and retry on unique index conflicts (code 11000)
            while (!userCreated && attempts < maxAttempts) {
               try {
                  user = await User.create({
                     username,
                     email,
                     googleId: profile.id,
                     provider: 'google',
                     isEmailVerified: true,
                     avatar: profile.photos?.[0]?.value || ''
                  });
                  userCreated = true;
               } catch (createErr) {
                  const isDuplicateUsername = 
                     createErr.code === 11000 && 
                     (createErr.message.includes('username') || (createErr.keyPattern && createErr.keyPattern.username));

                  if (isDuplicateUsername) {
                     // Collision detected. Generate a new candidate and retry.
                     username = `${baseUsername.slice(0, 20 - String(counter).length)}${counter}`;
                     counter++;
                     attempts++;
                  } else {
                     // Propagate other database errors (e.g., validation or other indexes)
                     throw createErr;
                  }
               }
            }

            if (!userCreated) {
               return done(
                  new Error('Failed to generate a unique username after maximum attempts.'),
                  null
               );
            }

            return done(null, user);

         } catch (err) {
            logger.error({ err }, 'Google OAuth Error');
            return done(err, null);
         }
      }
   )
);

module.exports = passport;