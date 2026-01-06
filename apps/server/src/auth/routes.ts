import { Router } from 'express';
import { passport } from './passport.js';
import { config } from '../config.js';

const router = Router();

// iOS app URL scheme
const IOS_CALLBACK_SCHEME = 'com.googleusercontent.apps.53956819632-pmic1t4i2ck0jm7mmg1hd85886aaql85';

// Start Google OAuth flow
// Add ?mobile=true for iOS app - uses OAuth state parameter
router.get('/google', (req, res, next) => {
  const isMobile = req.query.mobile === 'true';

  passport.authenticate('google', {
    scope: ['profile', 'email'],
    state: isMobile ? 'mobile' : 'web',
  })(req, res, next);
});

// Google OAuth callback
router.get('/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${config.frontendUrl}/login?error=auth_failed`,
  }),
  (req, res) => {
    // Check state parameter to determine if mobile auth
    const isMobile = req.query.state === 'mobile';

    if (isMobile) {
      // Redirect to iOS app with success
      res.redirect(`${IOS_CALLBACK_SCHEME}://auth/success`);
    } else {
      // Successful web authentication
      res.redirect(`${config.frontendUrl}/dashboard`);
    }
  }
);

// Get current user
router.get('/me', (req, res) => {
  if (req.isAuthenticated() && req.user) {
    res.json({
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      picture: req.user.picture,
    });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to destroy session' });
      }
      res.clearCookie('connect.sid');
      res.json({ success: true });
    });
  });
});

export { router as authRouter };
