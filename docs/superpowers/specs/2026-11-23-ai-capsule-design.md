# AI Capsule — Design Specification

**Assignment:** CSE3CWA / CSE5006 Assessment 3 — AI Capsule, Cloud-Deployed AI Prompt Manager
**Due:** Tuesday 24 November 2026, 11:59 pm AEST
**Weighting:** 25%
**Status:** Approved design, pre-implementation
**Author:** Vammy Johannis Jiang
**Date:** 2026-11-23

---

## 1. Goal

Build and **deploy to a real public cloud URL** a small full-stack application where an authenticated
user keeps their own AI prompt records.

A signed-in user can create, read, update and delete their own prompt records. Authentication is
GitHub OAuth; the Express backend issues its **own** JWT after a successful OAuth login and stores it
in a `Secure`, `HttpOnly` cookie named `token`. Every capsule route verifies that JWT and scopes all
data access to the identity inside it.

**Why the deployment matters:** per §3 and §14 of the brief, a localhost-only submission is capped at
**35/100**. Sections B–E (65 marks) require evidence of a working public deployment. Deployment is
therefore a first-class requirement, not a finishing step.

### Success criteria

| # | Criterion |
|---|---|
| 1 | The application runs on a public HTTPS URL that is not localhost |
| 2 | `GET /api/health` is public and returns `{ "status": "ok" }` |
| 3 | Both required cURL checks return `401 Unauthorized` against the deployed URL |
| 4 | GitHub OAuth login issues an application JWT in a `Secure`, `HttpOnly` cookie named `token` |
| 5 | All four `/api/capsules` routes are JWT-protected and scoped to the verified identity |
| 6 | A user can only read, update or delete their own records |
| 7 | Complete CRUD works through the React UI on the deployed URL |
| 8 | README + 3–5 min MP4 give the marker all evidence required by §11 and §13 |

---

## 2. Constraints from the brief (non-negotiable)

- **Frontend:** React. **Backend:** Node.js + Express. **Storage:** SQLite minimum.
- **Auth:** GitHub OAuth (Google accepted fallback). **Firebase Authentication is NOT permitted.**
- **Session:** application JWT issued by Express, stored in a **`Secure`, `HttpOnly` cookie named
  `token`**. `localStorage` and `Authorization: Bearer` are explicitly disallowed.
- **Exact API paths** (markers test them directly, cannot be renamed or re-prefixed):
  `/`, `/login`, `/dashboard`, `/api/health`, `GET|POST|PUT|DELETE /api/capsules`.
- `user_id` **must** come from the verified JWT, never from the browser.
- Secrets (`JWT_SECRET`, OAuth client secret, DB credentials) live in environment variables and are
  **never** committed.
- Submission: source ZIP (no `node_modules`/build folders) + 3–5 minute MP4, both uploaded to the LMS.

---

## 3. Architecture — Shape ①: single Express app, one origin

Express serves the **built React frontend and the API from the same URL**. The brief recommends this
(§8) because it removes CORS and cross-origin cookie configuration entirely; the `token` cookie is
same-origin, so `SameSite=Lax` works without any cross-site relaxation.

**Rejected alternative:** two deployed services (static frontend + API). It forces
`SameSite=None; Secure` plus exact CORS + `Access-Control-Allow-Origin`/`Allow-Credentials` handling,
where a single mismatch produces silent 401s. §3 and §8 state plainly that extra complexity earns no
extra marks.

```
Browser ──HTTPS──> Azure App Service (one origin)
                     │
                     ├── /api/*      Express JSON API (requireAuth on /api/capsules)
                     ├── /auth/*     OAuth redirect + callback
                     └── /*          React SPA (static build + history fallback)
                                          │
                                          └── SQLite file on persistent /home
```

Deployment target: **Azure App Service (Linux, Node 22)**, reached via **Azure for Students**, which
requires **no credit card**. Chosen over Render because Render's signup demanded a card. Azure App
Service also has a **persistent filesystem**, so the SQLite file survives restarts and redeploys —
unlike Render's free tier, which wipes local files.

---

## 4. Project layout

```
ai-capsule/
├── package.json                     # root: orchestrates build + start for the cloud runtime
├── .env.example                     # env var NAMES with placeholder values, no secrets
├── .gitignore
├── README.md
├── VIDEO_SCRIPT.md
├── docs/superpowers/specs/2026-11-23-ai-capsule-design.md
├── backend/
│   ├── package.json
│   ├── server.js                    # app wiring, static serving, SPA fallback, error handler
│   ├── env.js                       # fail-fast validation of required environment variables
│   ├── db.js                        # SQLite connection + schema init
│   ├── init.sql                     # single source of truth for the capsules schema
│   ├── validation.js                # capsule payload validation
│   ├── middleware/requireAuth.js    # verifies the JWT and sets req.user
│   ├── routes/auth.js               # /auth/github, /auth/github/callback, /auth/logout, /api/me
│   ├── routes/capsules.js           # GET/POST/PUT/DELETE /api/capsules
│   └── data/                        # local SQLite file (git-ignored)
└── frontend/
    ├── package.json
    ├── vite.config.js               # dev proxy /api + /auth -> :3001
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx                  # router
        ├── index.css
        ├── services/api.js          # fetch wrapper, credentials: 'include'
        ├── components/
        │   ├── Nav.jsx
        │   ├── RequireAuth.jsx      # route guard
        │   ├── CapsuleForm.jsx      # create + edit
        │   └── CapsuleCard.jsx
        └── pages/
            ├── Landing.jsx          # public  /
            ├── Login.jsx            # public  /login
            └── Dashboard.jsx        # protected /dashboard
```

**Build/run contract (root `package.json`):**

| Script | Purpose |
|---|---|
| `install:all` | `npm install` in `backend/` and `frontend/` |
| `build` | install both, then `npm run build --prefix frontend` |
| `start` | `node backend/server.js` |

Azure App Service runs `npm install` then `npm run build` (Oryx detects the `build` script), and the
startup command is set explicitly to `node backend/server.js`.

---

## 5. Data model

`init.sql` is the single source of truth; `db.js` executes it on boot. Schema is the brief's §6 schema
verbatim so every required field is retained.

```sql
CREATE TABLE IF NOT EXISTS capsules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  project_name TEXT NOT NULL,
  prompt_title TEXT NOT NULL,
  prompt_version TEXT,
  prompt_text TEXT NOT NULL,
  response_summary TEXT,
  category TEXT,
  usefulness TEXT,
  reviewed INTEGER DEFAULT 0,
  improved INTEGER DEFAULT 0,
  screenshot_url TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_capsules_user_id ON capsules(user_id);
```

| Field | Rule |
|---|---|
| `user_id` | GitHub numeric user id from the verified JWT. Never accepted from the client |
| `project_name`, `prompt_title`, `prompt_text` | Required, non-empty strings |
| `prompt_version` | Optional text (`v1`, `v2`, `v3`) |
| `reviewed`, `improved` | Booleans stored as `0`/`1` |
| `created_at` | Auto-generated by SQLite |

**Ownership is enforced in SQL, not in JavaScript filtering:** every read/update/delete carries
`WHERE ... user_id = ?`. `PUT`/`DELETE` use `WHERE id = ? AND user_id = ?` and return `404` when zero
rows are affected, so another user's record is neither readable nor writable.

**Storage path:** `DATABASE_PATH` environment variable; defaults to `backend/data/capsules.db` locally
and is set to `/home/data/capsules.db` on Azure (the persistent mount). `db.js` creates the parent
directory if missing.

---

## 6. Authentication flow

```
1.  GET  /login                     React public page, "Sign in with GitHub"
2.  GET  /auth/github               Express sets an httpOnly oauth_state cookie,
                                    redirects to github.com/login/oauth/authorize
                                    ?client_id=…&redirect_uri=…&scope=read:user&state=…
3.  GET  /auth/github/callback      Express:
                                      - compares ?state with the oauth_state cookie (CSRF), else 403
                                      - POSTs code + client_id + client_secret to
                                        github.com/login/oauth/access_token
                                      - GETs api.github.com/user with the access token
                                      - signs an application JWT: { sub, login, name, avatar }
                                      - sets cookie `token`
                                      - clears oauth_state
                                      - redirects to /dashboard
```

**GitHub token lifetime is irrelevant to us:** the GitHub access token is used exactly once, to read
the profile, and is never stored or reused. This is why "Expire user access tokens" can stay at
GitHub's default.

**Cookie configuration** (`res.cookie('token', jwt, { … })`):

| Attribute | Value | Reason |
|---|---|---|
| name | `token` | **Name is mandated by the brief** |
| `httpOnly` | `true` | JavaScript cannot read it; blocks XSS token theft |
| `secure` | `true` in production | Mandated; requires HTTPS, which Azure provides |
| `sameSite` | `lax` | The OAuth redirect back to us is a top-level GET; `lax` permits it and still blocks CSRF |
| `maxAge` | 7 days | Outlives the marking window |
| `path` | `/` | Sent to both API and pages |

`app.set('trust proxy', 1)` is required so Express sees the connection as HTTPS behind Azure's reverse
proxy; without it `secure` cookies are never set in production.

**Required environment variables** (names only — values never committed):

| Name | Purpose |
|---|---|
| `JWT_SECRET` | Signs and verifies the application JWT |
| `GITHUB_CLIENT_ID` | Public OAuth app identifier |
| `GITHUB_CLIENT_SECRET` | OAuth app secret |
| `DATABASE_PATH` | SQLite file location (`/home/data/capsules.db` in Azure) |
| `NODE_ENV` | `production` enables `secure` cookies |
| `PORT` | Provided by App Service; defaults to 3001 locally |

`env.js` validates these at boot and exits with a clear message naming any missing variable, so a
misconfigured deployment fails loudly instead of issuing unverifiable tokens.

**Deliberately not implemented:** Passport (unnecessary indirection — the flow is ~40 lines of
`fetch`), refresh tokens, and PKCE. GitHub now "strongly recommends" PKCE for the web flow; it adds no
marks here and is logged as a possible security improvement in §11.

---

## 7. API contract

### Public

| Route | Response |
|---|---|
| `GET /api/health` | `200 { "status": "ok" }` — no auth, so the deployed backend can be checked independently |

### Authentication

| Route | Behaviour |
|---|---|
| `GET /auth/github` | 302 to GitHub authorize URL |
| `GET /auth/github/callback` | Sets `token` cookie, 302 to `/dashboard`; `403` on state mismatch; `502` if GitHub fails |
| `GET /auth/logout` | Clears `token`, 302 to `/` |
| `GET /api/me` | `200 { id, login, name, avatar }` when authenticated, else `401` |

### Protected — all behind `requireAuth`

| Route | Behaviour | Failure |
|---|---|---|
| `GET /api/capsules` | Own records, newest first | `401` |
| `POST /api/capsules` | Create; owner from JWT; `201` + created record | `401`, `400` on invalid payload |
| `PUT /api/capsules/:id` | Update own record; `200` + updated | `401`, `404` if not owned, `400` invalid |
| `DELETE /api/capsules/:id` | Delete own record; `200 { "deleted": true, "id": n }` | `401`, `404` if not owned |

**Authentication failure contract:** no cookie, malformed JWT, wrong signature, or expired JWT all
return `401 { "error": "Unauthorized" }` and **never** capsule data. `requireAuth` distinguishes
"absent" from "present but invalid" internally for logging, but returns the same response to the
client so no information leaks.

---

## 8. Frontend

React 19 + Vite + `react-router-dom`.

| Route | Access | Behaviour |
|---|---|---|
| `/` | Public | Explains AI Capsule; links to sign in |
| `/login` | Public | "Sign in with GitHub" → `/auth/github`; shows OAuth errors from the query string |
| `/dashboard` | Protected | Own records + CRUD |

**Route guard:** `RequireAuth` calls `GET /api/me` on mount. `200` renders the dashboard; `401`
redirects to `/login`. The API itself is the authority — the guard is only user experience, so a user
who bypasses the UI still gets `401` from every capsule route.

**Dashboard behaviour:** list own records newest-first; create via `CapsuleForm`; edit pre-fills the
same form; delete asks for confirmation. Loading, empty-list, validation-error and request-error
states are all shown. `services/api.js` is a thin `fetch` wrapper with `credentials: 'include'` that
surfaces the backend's `{ error }` message.

**Dev proxy:** `vite.config.js` proxies `/api` and `/auth` to `http://localhost:3001`, mirroring the
single-origin production setup so cookies behave identically in both environments.

---

## 9. Deployment plan (Azure)

1. `git init`, push the project to a **public** GitHub repository (Deployment Center needs access).
2. Sign up at `azure.microsoft.com/free/students` with the La Trobe email — **no credit card**.
3. Create a **Web App**: Linux, Node 22, region Australia East, plan **F1 (free)** by default; move to
   **B1** (covered by the $100 student credit) only if the F1 CPU quota becomes a problem.
4. **Configuration → Application settings:** `JWT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`,
   `NODE_ENV=production`, `DATABASE_PATH=/home/data/capsules.db`.
5. **Configuration → Startup Command:** `node backend/server.js`.
6. **Deployment Center:** connect the GitHub repo and branch; Azure deploys on push.
7. Add the production callback URL to the GitHub OAuth App:
   `https://<app>.azurewebsites.net/auth/github/callback`.
8. Confirm the SQLite file appears at `/home/data/capsules.db` after first boot. App Service's `/home`
   mount is persistent and writable, and `db.js` creates the `data` directory if it is missing — so no
   manual permission step is required. This location is deliberately outside `wwwroot` so a redeploy
   cannot overwrite it.

**Post-deploy verification** (this is also the video evidence):

```bash
curl -i https://<app>.azurewebsites.net/api/health          # 200 {"status":"ok"}
curl -i https://<app>.azurewebsites.net/api/capsules        # 401 Unauthorized
curl -i -H "Cookie: token=fake-token-123" \
     https://<app>.azurewebsites.net/api/capsules           # 401 Unauthorized
```

Then sign in with GitHub and demonstrate CREATE, READ, UPDATE and DELETE in the deployed UI.

---

## 10. Testing strategy

Local, before deploying. Each layer targets a specific rubric section.

**A. API contract + security (Sections A and D).** A scripted suite against a locally running backend
using a JWT signed with the same secret the server uses:

- `GET /api/health` → `200 {"status":"ok"}` with no cookie
- `GET /api/capsules` with no cookie → `401`, body has no capsule data
- `GET /api/capsules` with `Cookie: token=fake-token-123` → `401` (proves signature verification, not
  mere cookie presence)
- The same two checks for `POST`, `PUT`, `DELETE`
- Tampered JWT (valid format, wrong signature) → `401`
- Expired JWT → `401`
- Valid JWT for user A: full create → read → update → delete cycle succeeds
- **Ownership isolation:** user B cannot read, update or delete user A's record (`404`), and B's
  `GET /api/capsules` never contains A's rows
- Missing required fields → `400`; `user_id` supplied in the request body is ignored

**B. OAuth mechanics.** Without performing a real login: `/auth/github` returns a 302 whose query
string carries `client_id`, `redirect_uri`, `scope` and an unguessable `state`; the `oauth_state`
cookie is set; `/auth/github/callback` with a missing or mismatched `state` returns `403`. The real
GitHub round trip is verified by the user in the video.

**C. UI (Sections A, B).** Headless-browser pass: `/` renders publicly; `/dashboard` redirects to
`/login` when unauthenticated; with a valid `token` cookie injected, the dashboard lists records and
create/edit/delete all work against the Local API.

**D. Deployed verification (Sections B, D).** The three cURL commands and a manual CRUD pass against
the live Azure URL, captured in the video.

---

## 11. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Azure for Students verification stalls or rejects | Blocks 65 marks | Start signup immediately; fallback platform (Hugging Face Docker Space) documented and ready |
| Azure build does not run the frontend build | Site loads without UI | Root `build` script orchestrates both installs; verify Oryx build logs; fallback: `postinstall` hook or commit `frontend/dist` |
| `sqlite3` native module fails to build on the build image | Backend won't boot | Prebuilt linux-x64 binaries exist; pin `engines.node`; fallback `better-sqlite3` |
| `secure` cookie never set behind Azure's proxy | Login appears to succeed then 401s everywhere | `trust proxy` set; `secure` only when `NODE_ENV=production`; verified by the deployed CRUD test |
| Free F1 plan CPU quota | Throttling during marking | Use B1 from the $100 credit if quota becomes a problem |
| SQLite file inside the deploy root wiped on redeploy | Data loss mid-marking | `DATABASE_PATH=/home/data/capsules.db`, outside `wwwroot` |
| `ltu-23025505` GitHub account deprovisioned | Lose OAuth App + repo mid-marking | Flagged to the author; brief requires the app stay available through marking |
| No PKCE on the OAuth flow | Minor hardening gap | Accepted; documented as an improvement, earns no marks |

---

## 12. Deliverables and evidence

| Deliverable | Contents |
|---|---|
| Source ZIP | Project without `node_modules`, build folders or the SQLite file |
| `README.md` | Deployed URL + platform; install/run commands; the mandated routes and how React talks to Express; OAuth provider and how the JWT is issued, stored and verified; environment-variable **names**; DB init, ownership storage, and whether storage is persistent; both cURL commands **with results**; one honest limitation |
| `VIDEO_SCRIPT.md` | Shot-by-shot script covering every §13 requirement |
| MP4 (3–5 min) | Deployed URL (not localhost), `/api/health`, both 401 cURL tests, OAuth login, full CRUD, cloud settings and env var names without secrets, storage/limitation explanation |
| AI-use statement | Tool used, what it helped with, one problem found and corrected, how OAuth/JWT/protected-API and ownership were verified, one implementation decision explained |
| AI acknowledgement form | Submitted via the LMS Assessments page |

**Stated limitation (honest, for the README):** the application neither implements refresh tokens nor
PKCE, and SQLite on App Service persists only for the life of the instance — a platform-level reset or
a move to a multi-instance plan would require a managed database instead.

**Worked-example seed:** none. The dashboard starts empty for a new user so the video shows a genuine
CREATE; no seed data is inserted.

---

## 13. Implementation order

1. Scaffold repo, root scripts, `.gitignore`, `.env.example`
2. Backend: `env.js`, `db.js`, `init.sql`, `validation.js`
3. `requireAuth` middleware + `/api/health` + `/api/capsules` CRUD
4. OAuth routes (`/auth/github`, callback, logout) + `/api/me`
5. Local API + security test suite (Section 10 A and B) — must pass before UI work
6. Frontend: router, guard, `services/api.js`, pages, components, CSS
7. Headless-browser UI pass (Section 10 C)
8. README + AI-use statement + `VIDEO_SCRIPT.md`
9. Push to GitHub, deploy to Azure, register the production callback URL
10. Deployed verification (Section 10 D), record the video, ZIP, submit

---

## 14. Change record

**2026-11-24 — deployment platform changed from Azure App Service to Render.**

*Why:* Azure for Students signup completed successfully, but Render was chosen instead to avoid
depending on student-eligibility verification remaining valid through the marking period.

*What changed:* the deployment target only. The application code required **no** change — it derives
the OAuth callback URL from the incoming request and reads its configuration from environment
variables, so it runs unmodified on either platform. `AZURE_DEPLOY.md` was replaced by
`RENDER_DEPLOY.md` and a `render.yaml` blueprint was added.

*One consequence to note:* Azure App Service's `/home` mount is persistent, whereas Render's free plan
has **no persistent disk**. The SQLite database is therefore **ephemeral** on Render — erased on every
restart, redeploy and 15-minute idle spin-down. Section 5's storage decision is unchanged (SQLite
remains appropriate for the assignment), but the storage characteristic moves from *persistent* to
*ephemeral*, and the brief explicitly asks for that to be documented as a limitation.

*Deployment hardening found while switching:* the root `build` script now installs with
`--include=dev`. npm omits `devDependencies` when `NODE_ENV=production`, and Vite plus the React plugin
are dev dependencies — without this the platform's build step would fail to find Vite. This applies to
any host that builds with `NODE_ENV=production`.
