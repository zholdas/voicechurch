import { Router } from 'express';
import { passport } from './passport.js';
import { config } from '../config.js';
import { createApiToken, deleteApiToken, findOrCreateUser, deleteUser } from '../db/index.js';
import appleSignin from 'apple-signin-auth';

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
      // Generate API token for mobile app
      const token = createApiToken(req.user.id);

      // Encode user data and token in URL for iOS app
      const userData = encodeURIComponent(JSON.stringify({
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        picture: req.user.picture,
        token: token,
      }));
      // Redirect to iOS app with user data and token
      res.redirect(`${IOS_CALLBACK_SCHEME}://auth/success?user=${userData}`);
    } else {
      // Successful web authentication
      res.redirect(`${config.frontendUrl}/dashboard`);
    }
  }
);

// Apple Sign-In for mobile (native iOS flow)
router.post('/apple/mobile', async (req, res) => {
  try {
    const { identityToken, authorizationCode, fullName, email } = req.body;

    if (!identityToken) {
      return res.status(400).json({ error: 'identityToken is required' });
    }

    // Verify the identity token with Apple
    const payload = await appleSignin.verifyIdToken(identityToken, {
      audience: config.apple.clientId,
      ignoreExpiration: false,
    });

    const appleUserId = payload.sub;
    const appleEmail = payload.email || email;

    if (!appleEmail) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find or create user
    const user = findOrCreateUser({
      appleId: appleUserId,
      email: appleEmail,
      name: fullName || appleEmail.split('@')[0],
    });

    // Generate API token
    const token = createApiToken(user.id);

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      token,
    });
  } catch (error) {
    console.error('Apple Sign-In error:', error);
    res.status(401).json({ error: 'Invalid Apple identity token' });
  }
});

// Apple Sign-In for web (OAuth redirect flow)
router.get('/apple', (req, res) => {
  if (!config.apple.webClientId || !config.apple.teamId || !config.apple.keyId) {
    return res.status(503).json({ error: 'Apple Sign-In not configured' });
  }

  const redirectUri = `${config.google.callbackUrl.replace('/google/callback', '/apple/callback')}`;
  console.log(`[Apple] Starting auth, clientID: ${config.apple.webClientId}, redirectUri: ${redirectUri}`);

  const authUrl = appleSignin.getAuthorizationUrl({
    clientID: config.apple.webClientId,
    redirectUri,
    scope: 'name email',
    state: 'web',
    responseMode: 'form_post',
  });

  res.redirect(authUrl);
});

// Apple Sign-In web callback (form_post)
router.post('/apple/callback', async (req, res) => {
  try {
    const { code, id_token, user: userJson } = req.body;

    if (!id_token && !code) {
      return res.redirect(`${config.frontendUrl}/login?error=apple_auth_failed`);
    }

    // Generate client secret for web
    const clientSecret = appleSignin.getClientSecret({
      clientID: config.apple.webClientId,
      teamID: config.apple.teamId,
      keyIdentifier: config.apple.keyId,
      privateKey: config.apple.privateKey,
    });

    let tokenResponse;
    if (code) {
      // Exchange authorization code for tokens
      tokenResponse = await appleSignin.getAuthorizationToken(code, {
        clientID: config.apple.webClientId,
        clientSecret,
        redirectUri: `${config.google.callbackUrl.replace('/google/callback', '/apple/callback')}`,
      });
    }

    const idToken = tokenResponse?.id_token || id_token;
    const payload = await appleSignin.verifyIdToken(idToken, {
      audience: config.apple.webClientId,
      ignoreExpiration: false,
    });

    const appleUserId = payload.sub;
    const appleEmail = payload.email;

    // Apple sends user info only on first auth (in form_post body)
    let fullName: string | undefined;
    if (userJson) {
      try {
        const userData = typeof userJson === 'string' ? JSON.parse(userJson) : userJson;
        const parts = [userData.name?.firstName, userData.name?.lastName].filter(Boolean);
        if (parts.length > 0) fullName = parts.join(' ');
      } catch { /* ignore parse errors */ }
    }

    if (!appleEmail) {
      return res.redirect(`${config.frontendUrl}/login?error=apple_email_required`);
    }

    // Find or create user
    const user = findOrCreateUser({
      appleId: appleUserId,
      email: appleEmail,
      name: fullName || appleEmail.split('@')[0],
    });

    // Log in with session (same as Google web flow)
    (req as any).login(user, (err: any) => {
      if (err) {
        console.error('Apple web login error:', err);
        return res.redirect(`${config.frontendUrl}/login?error=apple_auth_failed`);
      }
      res.redirect(`${config.frontendUrl}/dashboard`);
    });
  } catch (error) {
    console.error('Apple Sign-In web error:', error);
    res.redirect(`${config.frontendUrl}/login?error=apple_auth_failed`);
  }
});

// Get short-lived token for WebSocket authentication
router.get('/ws-token', (req, res) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const token = createApiToken(req.user.id, 5 * 60); // 5 minutes
  res.json({ token });
});

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
  // Check for API token logout
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    deleteApiToken(token);
    return res.json({ success: true });
  }

  // Session-based logout
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

// Delete account
router.delete('/me', (req, res) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const userId = (req.user as any).id;
  console.log(`[Auth] Deleting account for user ${userId}`);

  try {
    deleteUser(userId);
  } catch (error) {
    console.error('Failed to delete user:', error);
    return res.status(500).json({ error: 'Failed to delete account' });
  }

  req.logout((err) => {
    if (err) console.error('Logout error during account deletion:', err);
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ success: true });
    });
  });
});

export { router as authRouter };
