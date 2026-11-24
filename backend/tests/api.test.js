// API and security tests for AI Capsule.
//
// Runs the real Express app against a throwaway SQLite file, so it exercises the
// same code paths the deployed application uses.
//
//     cd backend && npm test
//
// Covers the brief's Section D requirements directly: the two cURL checks, all
// four verbs behind JWT middleware, and ownership isolation between two users.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const jwt = require('jsonwebtoken');

const { createApp } = require('../server');
const { openDatabase, initSchema } = require('../db');

const TEST_SECRET = 'test-secret-not-used-anywhere-else';
const USER_A = { id: '111111', login: 'user-a' };
const USER_B = { id: '222222', login: 'user-b' };

let passed = 0;
let failed = 0;

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`  FAIL ${name}\n       ${err.message}`);
  }
}

function tokenFor(user, options = {}) {
  const { expiresIn = '1h', secret = TEST_SECRET } = options;
  return jwt.sign({ login: user.login, name: user.login }, secret, {
    subject: user.id,
    expiresIn,
  });
}

async function main() {
  const dbPath = path.join(os.tmpdir(), `ai-capsule-test-${Date.now()}.db`);
  const db = openDatabase(dbPath);
  await initSchema(db);

  const config = {
    jwtSecret: TEST_SECRET,
    githubClientId: 'test-client-id',
    githubClientSecret: 'test-client-secret',
    databasePath: dbPath,
    port: 0,
    isProduction: false,
    appUrl: null,
  };

  const app = createApp({ config, db });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  const get = (url, headers = {}) => fetch(`${base}${url}`, { headers });
  const send = (method, url, body, headers = {}) =>
    fetch(`${base}${url}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  const cookieA = { Cookie: `token=${tokenFor(USER_A)}` };
  const cookieB = { Cookie: `token=${tokenFor(USER_B)}` };

  const VALID_CAPSULE = {
    project_name: 'SmartFarm Irrigation',
    prompt_title: 'Debug cloud deployment',
    prompt_version: 'v1',
    prompt_text: 'Why does my Node server fail to bind on the cloud host?',
    response_summary: 'Check the start command and the PORT binding.',
    category: 'Coding',
    usefulness: 'Good',
    reviewed: true,
    improved: false,
    screenshot_url: 'https://example.com/evidence.png',
    notes: 'Tested and worked',
  };

  console.log('== public health check ==');
  await check('GET /api/health returns 200 {status:"ok"} with no authentication', async () => {
    const res = await get('/api/health');
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'ok' });
  });

  console.log('== Section D: cURL checks reproduced against the app ==');
  await check('GET /api/capsules with no authentication returns 401', async () => {
    const res = await get('/api/capsules');
    assert.equal(res.status, 401);
  });
  await check('GET /api/capsules with cookie "token=fake-token-123" returns 401', async () => {
    const res = await get('/api/capsules', { Cookie: 'token=fake-token-123' });
    assert.equal(res.status, 401);
  });
  await check('401 responses carry no capsule data', async () => {
    const res = await get('/api/capsules', { Cookie: 'token=fake-token-123' });
    const body = await res.json();
    assert.deepEqual(Object.keys(body), ['error']);
    assert.equal(body.error, 'Unauthorized');
  });

  console.log('== all four verbs are behind JWT middleware ==');
  for (const [method, url, body] of [
    ['GET', '/api/capsules', undefined],
    ['POST', '/api/capsules', VALID_CAPSULE],
    ['PUT', '/api/capsules/1', VALID_CAPSULE],
    ['DELETE', '/api/capsules/1', undefined],
  ]) {
    await check(`${method} ${url} without a cookie returns 401`, async () => {
      const res = await send(method, url, body);
      assert.equal(res.status, 401);
    });
    await check(`${method} ${url} with a fake JWT returns 401`, async () => {
      const res = await send(method, url, body, { Cookie: 'token=fake-token-123' });
      assert.equal(res.status, 401);
    });
  }

  console.log('== token tampering and expiry ==');
  await check('JWT signed with the wrong secret returns 401', async () => {
    const forged = tokenFor(USER_A, { secret: 'a-different-secret' });
    const res = await get('/api/capsules', { Cookie: `token=${forged}` });
    assert.equal(res.status, 401);
  });
  await check('expired JWT returns 401', async () => {
    const expired = tokenFor(USER_A, { expiresIn: '-1s' });
    const res = await get('/api/capsules', { Cookie: `token=${expired}` });
    assert.equal(res.status, 401);
  });
  await check('structurally malformed token returns 401', async () => {
    const res = await get('/api/capsules', { Cookie: 'token=a.b.c' });
    assert.equal(res.status, 401);
  });

  console.log('== GET /api/me ==');
  await check('GET /api/me without a cookie returns 401', async () => {
    assert.equal((await get('/api/me')).status, 401);
  });
  await check('GET /api/me returns the identity from the verified JWT', async () => {
    const res = await get('/api/me', cookieA);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.id, USER_A.id);
    assert.equal(body.login, USER_A.login);
  });

  console.log('== CREATE (POST /api/capsules) ==');
  let createdId = null;
  await check('valid payload returns 201 and the created record', async () => {
    const res = await send('POST', '/api/capsules', VALID_CAPSULE, cookieA);
    assert.equal(res.status, 201);
    const body = await res.json();
    createdId = body.id;
    assert.ok(Number.isInteger(createdId));
    assert.equal(body.project_name, VALID_CAPSULE.project_name);
    assert.equal(body.prompt_text, VALID_CAPSULE.prompt_text);
    assert.equal(body.reviewed, 1);
    assert.equal(body.improved, 0);
    assert.equal(body.user_id, USER_A.id);
  });
  await check('user_id sent by the client is ignored (ownership comes from the JWT)', async () => {
    const res = await send('POST', '/api/capsules', { ...VALID_CAPSULE, user_id: USER_B.id }, cookieA);
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.user_id, USER_A.id, 'client-supplied user_id must not be trusted');
  });
  await check('extra unknown fields are not stored', async () => {
    const res = await send('POST', '/api/capsules', { ...VALID_CAPSULE, evil: 'x' }, cookieA);
    const body = await res.json();
    assert.equal(body.evil, undefined);
  });

  console.log('== validation ==');
  for (const [field, payload] of [
    ['project_name', { ...VALID_CAPSULE, project_name: '' }],
    ['prompt_title', { ...VALID_CAPSULE, prompt_title: '' }],
    ['prompt_text', { ...VALID_CAPSULE, prompt_text: '' }],
    ['reviewed', { ...VALID_CAPSULE, reviewed: 'maybe' }],
  ]) {
    await check(`missing or invalid ${field} returns 400`, async () => {
      const res = await send('POST', '/api/capsules', payload, cookieA);
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.ok(body.error.includes(field), `expected error to mention ${field}, got "${body.error}"`);
    });
  }
  await check('malformed JSON body returns 400', async () => {
    const res = await fetch(`${base}/api/capsules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...cookieA },
      body: '{not json',
    });
    assert.equal(res.status, 400);
  });

  console.log('== READ (GET /api/capsules) ==');
  await check('user A sees their own records', async () => {
    const res = await get('/api/capsules', cookieA);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.length >= 1);
    assert.ok(body.every((row) => row.user_id === USER_A.id));
  });
  await check('user B sees none of user A\'s records', async () => {
    const res = await get('/api/capsules', cookieB);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), []);
  });

  console.log('== UPDATE (PUT /api/capsules/:id) ==');
  await check('user A can update their own record', async () => {
    const res = await send(
      'PUT',
      `/api/capsules/${createdId}`,
      { ...VALID_CAPSULE, prompt_title: 'Updated title', usefulness: 'Needs Improvement' },
      cookieA
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.prompt_title, 'Updated title');
    assert.equal(body.usefulness, 'Needs Improvement');
  });
  await check('user B cannot update user A\'s record (404)', async () => {
    const res = await send(
      'PUT',
      `/api/capsules/${createdId}`,
      { ...VALID_CAPSULE, prompt_title: 'Hijacked' },
      cookieB
    );
    assert.equal(res.status, 404);
  });
  await check('user A\'s record was not modified by user B\'s attempt', async () => {
    const res = await get('/api/capsules', cookieA);
    const body = await res.json();
    const row = body.find((r) => r.id === createdId);
    assert.equal(row.prompt_title, 'Updated title');
  });

  console.log('== DELETE (DELETE /api/capsules/:id) ==');
  await check('user B cannot delete user A\'s record (404)', async () => {
    const res = await send('DELETE', `/api/capsules/${createdId}`, undefined, cookieB);
    assert.equal(res.status, 404);
  });
  await check('user A\'s record still exists after user B\'s delete attempt', async () => {
    const res = await get('/api/capsules', cookieA);
    const body = await res.json();
    assert.ok(body.some((r) => r.id === createdId));
  });
  await check('deleting a non-existent id returns 404', async () => {
    const res = await send('DELETE', '/api/capsules/999999', undefined, cookieA);
    assert.equal(res.status, 404);
  });
  await check('a non-numeric id returns 404', async () => {
    const res = await send('DELETE', '/api/capsules/abc', undefined, cookieA);
    assert.equal(res.status, 404);
  });
  await check('user A can delete their own record', async () => {
    const res = await send('DELETE', `/api/capsules/${createdId}`, undefined, cookieA);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { deleted: true, id: createdId });
  });
  await check('the deleted record is gone', async () => {
    const res = await get('/api/capsules', cookieA);
    const body = await res.json();
    assert.ok(!body.some((r) => r.id === createdId));
  });

  console.log('== OAuth entry points ==');
  await check('GET /auth/github redirects to GitHub with the required parameters', async () => {
    const res = await fetch(`${base}/auth/github`, { redirect: 'manual' });
    assert.equal(res.status, 302);
    const location = res.headers.get('location');
    const url = new URL(location);
    assert.equal(url.origin + url.pathname, 'https://github.com/login/oauth/authorize');
    assert.equal(url.searchParams.get('client_id'), config.githubClientId);
    assert.equal(url.searchParams.get('scope'), 'read:user');
    assert.ok(url.searchParams.get('state').length >= 16, 'state must be unguessable');
    assert.ok(url.searchParams.get('redirect_uri').endsWith('/auth/github/callback'));
  });
  await check('/auth/github sets an httpOnly oauth_state cookie', async () => {
    const res = await fetch(`${base}/auth/github`, { redirect: 'manual' });
    const setCookie = res.headers.get('set-cookie') || '';
    assert.ok(setCookie.includes('oauth_state='));
    assert.ok(setCookie.toLowerCase().includes('httponly'));
    assert.ok(setCookie.toLowerCase().includes('samesite=lax'));
  });
  await check('callback without a state parameter returns 403', async () => {
    const res = await fetch(`${base}/auth/github/callback?code=abc`, { redirect: 'manual' });
    assert.equal(res.status, 403);
  });
  await check('callback with a mismatched state returns 403', async () => {
    const res = await fetch(`${base}/auth/github/callback?code=abc&state=wrong`, {
      headers: { Cookie: 'oauth_state=expected' },
      redirect: 'manual',
    });
    assert.equal(res.status, 403);
  });
  await check('callback with a matching state but no code returns 403', async () => {
    const res = await fetch(`${base}/auth/github/callback?state=abc`, {
      headers: { Cookie: 'oauth_state=abc' },
      redirect: 'manual',
    });
    assert.equal(res.status, 403);
  });

  console.log('== unknown routes ==');
  await check('an unknown API route returns 404 JSON', async () => {
    const res = await get('/api/does-not-exist');
    assert.equal(res.status, 404);
    assert.equal((await res.json()).error, 'Not found');
  });

  server.close();
  db.close();
  fs.rmSync(dbPath, { force: true });

  console.log(`\nPASS=${passed} FAIL=${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Test harness error:', err);
  process.exit(1);
});
