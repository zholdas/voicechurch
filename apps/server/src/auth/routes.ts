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

    if (isMobile && req.user) {
      // Encode user data in URL for iOS app (since cookies don't share between WebAuth and URLSession)
      const userData = encodeURIComponent(JSON.stringify({
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        picture: req.user.picture,
      }));
      // Redirect to iOS app with user data
      res.redirect(`${IOS_CALLBACK_SCHEME}://auth/success?user=${userData}`);
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
