import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { findOrCreateUser, getUserById, type DbUser } from '../db/index.js';
import { config } from '../config.js';

// Extend Express types
declare global {
  namespace Express {
    interface User extends DbUser {}
  }
}

export function setupPassport(): void {
  // Serialize user to session
  passport.serializeUser((user: Express.User, done) => {
    done(null, user.id);
  });

  // Deserialize user from session
  passport.deserializeUser((id: string, done) => {
    const user = getUserById(id);
    done(null, user);
  });

  // Google OAuth Strategy
  if (config.google.clientId && config.google.clientSecret) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: config.google.clientId,
          clientSecret: config.google.clientSecret,
          callbackURL: config.google.callbackUrl,
        },
        (accessToken, refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            if (!email) {
              return done(new Error('No email provided by Google'));
            }

            const user = findOrCreateUser({
              googleId: profile.id,
              email,
              name: profile.displayName || email.split('@')[0],
              picture: profile.photos?.[0]?.value,
            });

            done(null, user);
          } catch (error) {
            done(error as Error);
          }
        }
      )
    );
    console.log('Google OAuth strategy configured');
  } else {
    console.warn('Google OAuth not configured - GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET required');
  }
}

export { passport };
