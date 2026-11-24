// GitHub OAuth login and the application JWT session.
//
// Flow:  /auth/github  ->  github.com/login/oauth/authorize
//        /auth/github/callback  ->  exchange code -> read profile -> sign JWT -> set cookie
//
// The GitHub access token is used once, to read the profile, and is then
// discarded. It is never stored or reused, which is why GitHub's default
// "expire user access tokens" setting has no effect here.

const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';

const STATE_COOKIE = 'oauth_state';
const SESSION_COOKIE = 'token';
const SESSION_DAYS = 7;

function sessionCookieOptions(config) {
  return {
    httpOnly: true, // JavaScript cannot read it - blocks XSS token theft
    secure: config.isProduction, // HTTPS only in production
    sameSite: 'lax', // the OAuth redirect back is a top-level GET
    path: '/',
  };
}

module.exports = function authRouter({ config }) {
  const router = express.Router();

  // The callback URL must exactly match one registered on the GitHub OAuth App.
  // Deriving it from the request keeps localhost and Azure correct without an
  // extra setting; APP_URL overrides it if ever needed.
  function callbackUrl(req) {
    const base = config.appUrl || `${req.protocol}://${req.get('host')}`;
    return `${base}/auth/github/callback`;
  }

  // Step 1 - send the user to GitHub.
  router.get('/github', (req, res) => {
    const state = crypto.randomBytes(16).toString('hex');

    // State is echoed back by GitHub and compared in the callback, which stops a
    // third party from feeding us an authorization code.
    res.cookie(STATE_COOKIE, state, {
      ...sessionCookieOptions(config),
      maxAge: 10 * 60 * 1000, // the authorization code itself expires after 10 minutes
    });

    const authorizeUrl = new URL(GITHUB_AUTHORIZE_URL);
    authorizeUrl.searchParams.set('client_id', config.githubClientId);
    authorizeUrl.searchParams.set('redirect_uri', callbackUrl(req));
    authorizeUrl.searchParams.set('scope', 'read:user');
    authorizeUrl.searchParams.set('state', state);

    res.redirect(authorizeUrl.toString());
  });

  // Step 2 - GitHub sends the user back with a temporary code.
  router.get('/github/callback', async (req, res) => {
    const { code, state } = req.query;
    const expectedState = req.cookies ? req.cookies[STATE_COOKIE] : undefined;

    res.clearCookie(STATE_COOKIE, { path: '/' });

    if (!code || !state || !expectedState || state !== expectedState) {
      console.warn('OAuth callback rejected: state check failed');
      return res.status(403).json({ error: 'OAuth state check failed' });
    }

    try {
      // Exchange the code for a GitHub access token.
      const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          client_id: config.githubClientId,
          client_secret: config.githubClientSecret,
          code,
          redirect_uri: callbackUrl(req),
        }),
      });
      const tokenBody = await tokenResponse.json();

      if (!tokenResponse.ok || !tokenBody.access_token) {
        console.error('GitHub token exchange failed:', tokenBody);
        return res.redirect('/login?error=token_exchange_failed');
      }

      // Read the profile. Re-validating identity here is required: a user can
      // switch GitHub accounts between step 1 and the callback.
      const profileResponse = await fetch(GITHUB_USER_URL, {
        headers: {
          Authorization: `Bearer ${tokenBody.access_token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'ai-capsule',
        },
      });

      if (!profileResponse.ok) {
        console.error('GitHub profile request failed:', profileResponse.status);
        return res.redirect('/login?error=profile_failed');
      }

      const profile = await profileResponse.json();

      // The application JWT. `sub` is the GitHub user id - the value every
      // capsule row is scoped to. Signed with our own secret, so it is entirely
      // separate from the GitHub access token.
      const sessionToken = jwt.sign(
        {
          login: profile.login,
          name: profile.name || profile.login,
          avatar: profile.avatar_url,
        },
        config.jwtSecret,
        { subject: String(profile.id), expiresIn: `${SESSION_DAYS}d` }
      );

      res.cookie(SESSION_COOKIE, sessionToken, {
        ...sessionCookieOptions(config),
        maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
      });

      console.log(`Session started for GitHub user ${profile.login} (${profile.id})`);
      return res.redirect('/dashboard');
    } catch (err) {
      console.error('OAuth callback error:', err);
      return res.redirect('/login?error=github_unreachable');
    }
  });

  // Sign out - clears the session cookie.
  router.get('/logout', (req, res) => {
    res.clearCookie(SESSION_COOKIE, sessionCookieOptions(config));
    res.redirect('/');
  });

  return router;
};

module.exports.SESSION_COOKIE = SESSION_COOKIE;
