// Configuration loaded from environment variables.
//
// Required variables are validated at boot so a misconfigured deployment fails
// loudly instead of quietly issuing tokens nobody can verify.

const path = require('path');

const REQUIRED = ['JWT_SECRET', 'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'];

const DEFAULT_PORT = 3001;

function loadConfig(env = process.env) {
  const missing = REQUIRED.filter((name) => !env[name] || String(env[name]).trim() === '');

  if (missing.length > 0) {
    console.error(`Missing required environment variable(s): ${missing.join(', ')}`);
    console.error('');
    console.error('Locally:  cp .env.example backend/.env  then fill it in and run `npm run dev:backend`.');
    console.error('On Azure: add them under Configuration -> Application settings.');
    process.exit(1);
  }

  const port = Number(env.PORT) || DEFAULT_PORT;

  return {
    jwtSecret: env.JWT_SECRET,
    githubClientId: env.GITHUB_CLIENT_ID,
    githubClientSecret: env.GITHUB_CLIENT_SECRET,

    // Azure App Service: set DATABASE_PATH=/home/data/capsules.db so the file
    // lives on the persistent mount instead of inside the deploy directory.
    databasePath: env.DATABASE_PATH || path.join(__dirname, 'data', 'capsules.db'),

    port,

    // Secure cookies require HTTPS. Azure provides it; local dev does not.
    isProduction: env.NODE_ENV === 'production',

    // Optional override for the OAuth callback base URL. When unset the callback
    // is derived from the incoming request, which is correct on both
    // http://localhost:3001 and https://<app>.azurewebsites.net.
    appUrl: env.APP_URL || null,
  };
}

module.exports = { loadConfig };
