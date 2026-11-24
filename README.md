# AI Capsule — Cloud-Deployed AI Prompt Manager

A small full-stack application for keeping useful AI prompts. Sign in with GitHub, then create,
read, update and delete your own prompt records — the prompt, the project it belongs to, what the
model replied, how useful it was, whether you reviewed and improved it, plus a screenshot link and
your own notes.

Each record belongs to the GitHub identity that created it. Ownership is enforced in the database
layer, not in the browser.

**Assignment:** CSE3CWA / CSE5006 Assessment 3 — AI Capsule
**Built with:** React · Node.js / Express · SQLite · GitHub OAuth · JWT session

---

## 1. Deployed application

| | |
|---|---|
| **Public URL** | `https://ai-capsule-<yourname>.azurewebsites.net` ← replace with your deployed URL |
| **Platform** | Microsoft Azure App Service (Linux, Node 22) |
| **Health check** | `https://ai-capsule-<yourname>.azurewebsites.net/api/health` |

> A localhost-only copy does not demonstrate the assessed cloud requirements, so the deployed URL
> above is the primary evidence. The deployment steps that produced it are in
> [`AZURE_DEPLOY.md`](AZURE_DEPLOY.md).

---

## 2. Installation and running

Requires **Node.js 18 or newer** (developed on Node 22) and npm.

### One-time setup

```bash
npm run install:all                       # installs backend/ and frontend/ dependencies
cp .env.example backend/.env              # then fill in the real values (see section 7)
```

`backend/.env` is git-ignored. It must never be committed.

### Development (two processes)

```bash
npm run dev:backend     # Express API on http://localhost:3001
npm run dev:frontend    # React app on http://localhost:5173
```

Open **http://localhost:5173**. The dev server proxies `/api` and `/auth` to the backend, mirroring
the single-origin production setup so the session cookie behaves identically in both environments.

### Production (one process, one origin — how the cloud runs it)

```bash
npm run build           # installs both, builds the React app into frontend/dist
npm start               # Express serves the API *and* the built frontend on PORT
```

Then open **http://localhost:3001**. This is the same shape Azure App Service uses: one origin, no
CORS, no cross-origin cookie configuration. If `frontend/dist` does not exist the API still runs,
but the pages will 404 — run `npm run build` first.

### Tests

```bash
cd backend && npm test  # 42 API and security checks against a throwaway database
```

---

## 3. Architecture

```
Browser ──HTTPS──> Azure App Service (single origin)
                     ├── /api/*    Express JSON API   (requireAuth on /api/capsules)
                     ├── /auth/*   OAuth redirect and callback
                     └── /*        built React SPA + history fallback
                                        │
                                        └── SQLite file on the persistent /home mount
```

Serving the frontend and API from **one origin** is deliberate and is what the brief recommends: it
removes CORS entirely and keeps the session cookie same-origin, so `SameSite` can stay at the safe
default of `Lax`.

```
ai-capsule/
├── package.json                      # root build/start contract used by Azure
├── .env.example                      # environment variable NAMES with placeholders
├── backend/
│   ├── server.js                     # app wiring, static serving, SPA fallback, error handler
│   ├── env.js                        # fail-fast validation of required variables
│   ├── db.js                         # SQLite connection + schema bootstrap
│   ├── init.sql                      # single source of truth for the schema
│   ├── validation.js                 # capsule payload validation
│   ├── middleware/requireAuth.js     # verifies the JWT, sets req.user
│   ├── routes/auth.js                # OAuth + session cookie
│   ├── routes/capsules.js            # CRUD, scoped by owner
│   └── tests/api.test.js             # 42 API + security checks
└── frontend/
    └── src/
        ├── App.jsx                   # router
        ├── services/api.js           # fetch wrapper
        ├── components/               # Layout, RequireAuth, CapsuleForm, CapsuleCard
        └── pages/                    # Landing (/), Login (/login), Dashboard (/dashboard)
```

---

## 4. API routes

| Route | Access | Purpose |
|---|---|---|
| `/` | Public | Landing page explaining AI Capsule |
| `/login` | Public | Starts GitHub sign-in |
| `/dashboard` | Protected | The signed-in user's records |
| `GET /api/health` | Public | Returns `{ "status": "ok" }` |
| `GET /api/capsules` | Protected | Read own records |
| `POST /api/capsules` | Protected | Create own record |
| `PUT /api/capsules/:id` | Protected | Update own record |
| `DELETE /api/capsules/:id` | Protected | Delete own record |
| `GET /api/me` | Protected | Identity of the current session (used by the route guard) |
| `GET /auth/github` | Public | Redirects to GitHub |
| `GET /auth/github/callback` | Public | Completes sign-in, sets the session cookie |
| `GET /auth/logout` | Public | Clears the session cookie |

**How React talks to Express:** the frontend calls these routes with `fetch` from
`frontend/src/services/api.js`, always with `credentials: 'include'` so the session cookie is sent.
In the deployed application the frontend and API share an origin, so these are same-origin requests.
A non-`2xx` response is turned into an `Error` carrying the server's `{ "error": ... }` message, which
the UI displays.

**Error format:** every failure is JSON. `401 { "error": "Unauthorized" }` for missing, malformed,
tampered or expired sessions; `404 { "error": "Capsule not found" }` when a record does not exist
*for the signed-in user*; `400` for invalid payloads.

---

## 5. Authentication: GitHub OAuth and the application JWT

The login provider is **GitHub OAuth**. (No Google fallback was needed, so there is no fallback
reason to record.)

```
/login  --click-->  GET /auth/github
                      sets an httpOnly `oauth_state` cookie (CSRF, 10 min)
                      redirects to github.com/login/oauth/authorize
                        ?client_id=…&redirect_uri=…&scope=read:user&state=…
GET /auth/github/callback
                      compares ?state with the oauth_state cookie  -> 403 on mismatch
                      POST github.com/login/oauth/access_token (code + client secret)
                      GET  api.github.com/user with the access token
                      signs the application JWT   { sub, login, name, avatar }
                      sets cookie `token`  ->  redirect /dashboard
```

**The GitHub access token is used once and discarded.** It is never stored, never sent to the
browser and never reused, so GitHub's 8-hour token expiry has no effect on this application.

### How the JWT is issued, stored and verified

- **Issued:** after the profile is read, the backend signs its own token with `JWT_SECRET`
  (`jsonwebtoken`, 7-day expiry). The `sub` claim is the GitHub numeric user id — the value every
  capsule row is scoped to. This token is entirely separate from the GitHub access token.
- **Stored:** in a cookie named **`token`** with `httpOnly` (page scripts cannot read it), `secure`
  in production (HTTPS only), `sameSite=lax`, `path=/`. `localStorage` and `Authorization: Bearer`
  are not used.
- **Verified:** the `requireAuth` middleware reads `req.cookies.token` and calls `jwt.verify` with
  the secret, which validates both the signature and the expiry. Identity is taken only from the
  verified payload.
- **Rejections are uniform:** absent, malformed, tampered and expired tokens all return the same
  `401 { "error": "Unauthorized" }`, so the client cannot tell *why* it was rejected. The real
  reason is logged server-side. A request that fails is never able to return capsule data.

`app.set('trust proxy', 1)` is required on Azure: App Service terminates TLS and forwards the
request over HTTP, so without it Express would not set `Secure` cookies and every request after login
would 401.

---

## 6. Database, ownership and persistence

**Schema** (`backend/init.sql`, executed by `db.js` on every boot):

| Column | Notes |
|---|---|
| `id` | SQLite auto-increment primary key |
| `user_id` | GitHub numeric user id. **Never** accepted from the client |
| `project_name`, `prompt_title`, `prompt_text` | Required |
| `prompt_version`, `response_summary`, `category`, `usefulness`, `screenshot_url`, `notes` | Optional |
| `reviewed`, `improved` | Booleans stored as `0`/`1` |
| `created_at` | Auto-generated timestamp |

**Initialisation:** `init.sql` runs on startup with `CREATE TABLE IF NOT EXISTS`, so it is idempotent
and safe on every boot. There is no seed data — a new user starts with an empty dashboard, which is
why the demonstration video shows a genuine CREATE.

**How ownership is stored and enforced:** `user_id` is written from the verified JWT at insert time.
Every subsequent query is scoped in SQL:

```sql
SELECT * FROM capsules WHERE user_id = ? ORDER BY id DESC
UPDATE capsules SET … WHERE id = ? AND user_id = ?
DELETE FROM capsules         WHERE id = ? AND user_id = ?
```

There is no application-level filtering to forget, and no code path that can return another user's
row. A foreign record is indistinguishable from a missing one: both return `404`.

**Persistence:** the database file location comes from `DATABASE_PATH`. On Azure it is set to
`/home/data/capsules.db`. The App Service `/home` mount is **persistent** across restarts and
redeploys, and it sits outside `wwwroot` so a redeploy cannot overwrite it. Storage is therefore
persistent for the life of the App Service instance — but it is **not** a managed database, so a
platform-level reset or a move to multiple instances would require Postgres instead (see section 10).

---

## 7. Environment variables

Names only — no values appear anywhere in this repository.

| Name | Required | Purpose |
|---|---|---|
| `JWT_SECRET` | Yes | Signs and verifies the application JWT. Long random string |
| `GITHUB_CLIENT_ID` | Yes | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | Yes | GitHub OAuth App client secret |
| `DATABASE_PATH` | On Azure | SQLite file path (`/home/data/capsules.db`). Defaults to `backend/data/capsules.db` |
| `NODE_ENV` | On Azure | `production` enables `Secure` cookies |
| `PORT` | No | Set by the platform. Defaults to 3001 |
| `APP_URL` | No | Overrides the derived OAuth callback base URL |

`env.js` validates the three required variables at boot and exits with a message naming any that are
missing, so a misconfigured deployment fails loudly rather than issuing tokens nobody can verify.

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## 8. Required cURL evidence

Both commands target the deployed `GET /api/capsules` endpoint.

**Test 1 — no authentication**

```bash
curl -i https://ai-capsule-<yourname>.azurewebsites.net/api/capsules
```

Result (run locally against the same code path; this test is repeated against the deployed URL and
shown in the video):

```
HTTP/1.1 401 Unauthorized
Content-Type: application/json; charset=utf-8

{"error":"Unauthorized"}
```

**Test 2 — fake / invalid JWT**

```bash
curl -i -H "Cookie: token=fake-token-123" https://ai-capsule-<yourname>.azurewebsites.net/api/capsules
```

Result:

```
HTTP/1.1 401 Unauthorized
Content-Type: application/json; charset=utf-8

{"error":"Unauthorized"}
```

Test 1 proves the endpoint requires authentication. Test 2 proves the backend actually **verifies**
the JWT rather than merely checking that a cookie exists — `fake-token-123` is not a well-formed
token, so `jwt.verify` rejects it. Both cases are covered by automated tests in
`backend/tests/api.test.js`, along with a token signed with the wrong secret and an expired token.

**Public health check**

```bash
curl -i https://ai-capsule-<yourname>.azurewebsites.net/api/health
# {"status":"ok"}
```

---

## 9. Testing

`cd backend && npm test` runs **42 checks** against a throwaway database using the real app:

- `GET /api/health` is public and returns `{ "status": "ok" }`
- Both required cURL cases return `401` with no capsule data in the body
- All four verbs (`GET`, `POST`, `PUT`, `DELETE`) return `401` with no cookie and with a fake JWT
- A token signed with the wrong secret, an expired token and a malformed token all return `401`
- Create → read → update → delete works for the record's owner
- **Ownership isolation:** a second user cannot read, update or delete the first user's record
  (`404`), and their own list never contains it
- A `user_id` supplied in the request body is ignored; unknown fields are not stored
- Missing required fields return `400`; malformed JSON returns `400`
- `/auth/github` redirects with `client_id`, `redirect_uri`, `scope` and an unguessable `state`, and
  sets an `httpOnly` `oauth_state` cookie
- The callback returns `403` when `state` is missing or does not match

The browser UI was additionally driven end-to-end (27 checks): the landing page renders publicly,
`/dashboard` redirects to `/login` without a session, and with a valid session the dashboard renders
the identity from the JWT, blocks an empty form with validation, then creates, re-reads after a
reload, updates and deletes a record, and shows a second user an empty list.

---

## 10. One honest limitation

**The session is issued once and never refreshed, and storage is instance-bound.**

The application JWT is a fixed 7-day token with no refresh mechanism, and it cannot be revoked
before it expires — signing out clears the cookie, but a copy of the token taken before sign-out
would remain valid until expiry. The OAuth flow also omits PKCE, which GitHub now recommends.

The same class of limitation applies to storage: SQLite is persistent on the App Service `/home`
mount, but it is a single local file with no replication or backup, and it is tied to one instance.
Scaling the app to multiple instances, or losing the mount, would lose or diverge data. A managed
database such as Postgres would be the correct fix for anything beyond a single-instance assessment
deployment.

---

## 11. AI-assisted development

### Tools used

ChatGPT and an AI coding assistant were used for project scaffolding, the Express route layout, React
component structure, SQL, CSS wording, deployment configuration and debugging. I validated each piece
against the assessment requirements and verified the behaviour myself with the automated and browser
tests described in section 9.

### Problems found in AI-generated code and configuration

1. **The dev-server proxy broke the OAuth callback URL.** The generated `vite.config.js` set
   `changeOrigin: true`, which rewrites the `Host` header to the proxy target. Because the OAuth
   callback URL is derived from the incoming host, the redirect would have pointed at the backend
   port (`localhost:3001`) instead of the page origin, so sign-in would land on the wrong origin in
   development. I removed `changeOrigin` so the original host survives the hop, which keeps the
   callback correct locally and on Azure with no extra setting.
2. **`trust proxy` was missing behind the Azure reverse proxy.** Azure terminates TLS and forwards
   plain HTTP, so without `app.set('trust proxy', 1)` Express refuses to set `Secure` cookies. The
   symptom is a login that appears to succeed and then 401s on every subsequent request — a confusing
   failure to debug after deployment, which is why it is handled in the code and documented above.

### How OAuth, JWT verification and protected API behaviour were verified

`npm test` exercises the real middleware: a request with no cookie returns `401`; a request with
`token=fake-token-123` returns `401`; a token signed with the wrong secret returns `401`; an expired
token returns `401`; all four CRUD verbs are checked both ways. The `/auth/github` redirect is
asserted to carry `client_id`, `redirect_uri`, `scope=read:user` and a random 32-character `state`,
with an `httpOnly` `oauth_state` cookie set; the callback returns `403` when that state is missing or
mismatched. The real GitHub round trip is demonstrated in the video.

### How CRUD behaviour and user data ownership were verified

CRUD is verified twice: through the API suite (create returns `201` with the stored values; update is
scoped and persists; delete returns `{ "deleted": true, "id": … }`; a `user_id` in the request body is
ignored) and through the browser, where a record is created, re-read after a page reload, updated and
deleted. Ownership is verified by signing a second session token for a different `user_id`: that user
sees an empty list, receives `404` when attempting to update or delete the first user's record, and
the first user's record is confirmed unchanged afterwards.

### An implementation decision I made and can explain

**Ownership is enforced in SQL, and a foreign record is reported as `404` rather than `403`.**

Every statement is scoped with `WHERE … user_id = ?`, where `user_id` comes from the verified JWT, so
there is no application-level filter that could be forgotten on a new route. I chose `404` over `403`
deliberately: a `403` would confirm that a record with that id exists, which lets an attacker
enumerate other users' record ids. Returning the same `404` as for a genuinely missing row means a
foreign record and a non-existent record are indistinguishable from the outside, and the user-facing
behaviour is identical in both cases.

---

## 12. Project structure of the evidence

| File | Purpose |
|---|---|
| `README.md` | This document |
| `AZURE_DEPLOY.md` | Reproducible deployment steps for Azure App Service |
| `VIDEO_SCRIPT.md` | Shot list for the 3–5 minute demonstration |
| `backend/tests/api.test.js` | 42 API and security checks |
| `docs/superpowers/specs/2026-11-23-ai-capsule-design.md` | Design specification written before implementation |
