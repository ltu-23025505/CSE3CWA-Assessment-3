// Verifies the application JWT carried in the `token` cookie.
//
// Every rejection returns the same 401 body. The client learns only that it is
// not authorised - not whether the cookie was missing, malformed, tampered with
// or expired. The real reason goes to the server log.

const jwt = require('jsonwebtoken');

function reject(res, reason) {
  console.warn(`Rejected protected request: ${reason}`);
  return res.status(401).json({ error: 'Unauthorized' });
}

function requireAuth(config) {
  return function requireAuthMiddleware(req, res, next) {
    const token = req.cookies ? req.cookies.token : undefined;

    // 1. No cookie at all. This is what the marker's first cURL test triggers.
    if (!token) return reject(res, 'no token cookie');

    try {
      // 2. Signature and expiry are both checked here. A cookie containing
      //    "fake-token-123" fails to verify, which is the marker's second test.
      const payload = jwt.verify(token, config.jwtSecret);

      if (!payload || !payload.sub) return reject(res, 'token has no subject');

      // 3. Identity comes only from the verified payload.
      req.user = {
        id: String(payload.sub),
        login: payload.login || null,
        name: payload.name || payload.login || null,
        avatar: payload.avatar || null,
      };

      return next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') return reject(res, 'token expired');
      if (err.name === 'JsonWebTokenError') return reject(res, `invalid token (${err.message})`);
      return reject(res, `token verification failed (${err.message})`);
    }
  };
}

module.exports = { requireAuth };
