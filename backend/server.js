// AI Capsule - Express application.
//
// One origin serves both the API and the built React frontend, which is what the
// brief recommends: no CORS, and the session cookie is same-origin so SameSite
// can stay at the safe default of Lax.

const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');

const { loadConfig } = require('./env');
const { openDatabase, initSchema } = require('./db');
const { requireAuth } = require('./middleware/requireAuth');
const authRouter = require('./routes/auth');
const capsulesRouter = require('./routes/capsules');

const CLIENT_DIR = path.join(__dirname, '..', 'frontend', 'dist');

function createApp({ config, db }) {
  const app = express();

  // Azure terminates TLS at its proxy and forwards the request over HTTP.
  // Trusting the first proxy hop is what makes req.protocol report https, which
  // in turn lets Express set Secure cookies. Without this every login on Azure
  // would appear to succeed and then 401 on the next request.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(express.json());
  app.use(cookieParser());

  // ------------------------------------------------------------------ public

  // Public health check, so the deployed backend can be verified on its own.
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // -------------------------------------------------------------------- auth

  app.use('/auth', authRouter({ config }));

  // Identity of the current session, used by the frontend route guard.
  app.get('/api/me', requireAuth(config), (req, res) => {
    res.json(req.user);
  });

  // ----------------------------------------------------------- protected CRUD

  app.use('/api/capsules', requireAuth(config), capsulesRouter({ db }));

  // --------------------------------------------------------- static frontend

  if (fs.existsSync(CLIENT_DIR)) {
    app.use(express.static(CLIENT_DIR));

    // History fallback: /dashboard and /login are client-side routes, so any
    // non-API GET that reaches here must return the single-page app shell.
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api/') || req.path.startsWith('/auth/')) {
        return next();
      }
      return res.sendFile(path.join(CLIENT_DIR, 'index.html'));
    });
  }

  // ------------------------------------------------------------------ errors

  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    if (err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError)) {
      return res.status(400).json({ error: 'Request body is not valid JSON' });
    }
    console.error('Unexpected server error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

async function start() {
  const config = loadConfig();
  const db = openDatabase(config.databasePath);
  await initSchema(db);

  const app = createApp({ config, db });

  const server = app.listen(config.port, () => {
    console.log(`AI Capsule listening on port ${config.port}`);
    console.log(`  database: ${config.databasePath}`);
    console.log(`  mode:     ${config.isProduction ? 'production (Secure cookies)' : 'development'}`);
  });

  const shutdown = () => {
    server.close(() => db.close(() => process.exit(0)));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return { app, server, db, config };
}

if (require.main === module) {
  start().catch((err) => {
    console.error('Failed to start AI Capsule:', err);
    process.exit(1);
  });
}

module.exports = { createApp, start, CLIENT_DIR };
