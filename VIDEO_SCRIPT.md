# Video demonstration script (3–5 minutes)

The video is the main evidence that the application is genuinely deployed and working on the public
Internet. **Record the deployed application, not localhost.**

Have these ready before you start:
- The deployed URL in a browser tab
- A terminal with the cURL commands pre-typed
- A second browser tab open on the Azure Portal — **Overview** and **Environment variables** blades

Do **not** show your real JWT, your client secret or your `JWT_SECRET` on screen.

---

## 0:00 – 0:25 · Deployed URL (not localhost)

Show the browser address bar.

> "This is AI Capsule, running on Azure App Service at
> `https://ai-capsule-…azurewebsites.net`. It is not localhost — it's a public HTTPS URL on a real
> cloud platform. The app is a React frontend, an Express backend and a SQLite database, all served
> from this one origin."

---

## 0:25 – 0:55 · Health check

```bash
curl -i https://ai-capsule-<yourname>.azurewebsites.net/api/health
```

> "The health endpoint is public so the deployed backend can be checked on its own. It returns
> `{"status":"ok"}` — so the Express backend is live, not just the frontend."

---

## 0:55 – 1:40 · Both 401 tests, before logging in

```bash
curl -i https://ai-capsule-<yourname>.azurewebsites.net/api/capsules
```

> "Test one: `GET /api/capsules` with no authentication. It returns `401 Unauthorized` with a JSON
> error body. No capsule data at all."

```bash
curl -i -H "Cookie: token=fake-token-123" https://ai-capsule-<yourname>.azurewebsites.net/api/capsules
```

> "Test two: the same request with a fake token in the cookie. Also `401 Unauthorized`. That's the
> important one — it proves the server actually **verifies** the JWT signature rather than just
> checking whether a cookie exists. A cookie that isn't a valid signed token is rejected."

> "All four CRUD routes use the same middleware — GET, POST, PUT and DELETE are all protected, and
> the source code shows each one mounted behind it."

---

## 1:40 – 2:10 · GitHub OAuth login

Click **Continue with GitHub**, authorise, land on `/dashboard`.

> "Signing in goes through GitHub. The server sends me to GitHub with a random `state` value, GitHub
> returns a one-time code, and the server exchanges that code for my profile. It then signs its
> **own** session token — this is the application's JWT, not GitHub's access token — and stores it in
> a `Secure`, `HttpOnly` cookie called `token`. The dashboard shows my GitHub identity, which came
> from the verified token, not from anything the browser sent."

If the dashboard is empty, mention it:

> "The list is empty because this is a fresh account — there's no seed data, so everything you're
> about to see is a real database write."

---

## 2:10 – 3:20 · Complete CRUD on the deployed app

**CREATE** — click **New capsule**, fill in Project `SmartFarm Irrigation`, title `Debug cloud
deployment`, version `v1`, category `Coding`, usefulness `Good`, tick **Reviewed**, paste a prompt
and a response summary, then **Create capsule**.

> "That's a `POST` to `/api/capsules`. It's saved with my user id, taken from the verified token."

**READ** — reload the page.

> "Reloading re-reads from `/api/capsules`. The record is still there, so this came out of the
> deployed SQLite database, not React state."

**UPDATE** — click **Edit**, change the title to `Debug cloud deployment (fixed)` and usefulness to
`Needs Improvement`, **Save changes**.

> "A `PUT`, scoped to my user id. One record is updated rather than duplicated."

**DELETE** — click **Delete**, confirm.

> "A `DELETE`. The record is gone and the empty state returns. Every one of those operations was
> limited to records owned by the identity in my signed token."

> "If I sign in with a different GitHub account, I see that account's records only — never these."

---

## 3:20 – 4:00 · Cloud configuration, no secrets

Switch to the Azure Portal.

- **Overview** — show the resource name, region, Linux, Node 22, and the `*.azurewebsites.net` host.
- **Environment variables** — show the setting **names**: `JWT_SECRET`, `GITHUB_CLIENT_ID`,
  `GITHUB_CLIENT_SECRET`, `NODE_ENV`, `DATABASE_PATH`.

> "These are the environment variables. The secret values are hidden — I'm only showing the names.
> `NODE_ENV=production` is what makes the session cookie `Secure`, and `DATABASE_PATH` points the
> database at the persistent `/home` mount rather than the deploy folder."

- **Deployment Center** — show the successful GitHub deployment.

---

## 4:00 – 4:35 · Storage, persistence and limitations

> "Storage is SQLite, a single file at `/home/data/capsules.db`. App Service's `/home` mount is
> persistent across restarts and redeployments, and it sits outside the deploy folder so a redeploy
> can't overwrite it.

> The limitation is that this is still one local file on one instance: there's no replication and no
> backup, so it doesn't scale beyond a single instance the way a managed Postgres database would.

> One deployment issue worth mentioning: Azure terminates HTTPS and forwards the request over plain
> HTTP, so the app has to trust that proxy hop. Without that setting, Express won't set a `Secure`
> cookie, and the confusing symptom is a login that appears to work and then every request returns
> 401."

---

## 4:35 – 5:00 · Wrap up

> "So: a public Azure deployment, a public health check, both unauthenticated requests correctly
> rejected, GitHub OAuth issuing the application's own JWT into an HttpOnly cookie, and the full
> create, read, update and delete cycle working against the deployed API with per-user data
> isolation. That's AI Capsule."

---

## Before uploading

- [ ] The address bar clearly shows the `*.azurewebsites.net` URL, **not** localhost
- [ ] `/api/health` returns `{"status":"ok"}`
- [ ] Both cURL tests visibly return `401 Unauthorized`
- [ ] GitHub sign-in completes and the dashboard appears
- [ ] CREATE, READ, UPDATE and DELETE are all shown on the deployed app
- [ ] Azure settings show environment-variable **names**, with no secret values visible
- [ ] Storage approach, the persistence limitation and one deployment issue are explained
- [ ] No real JWT, client secret or `JWT_SECRET` appears on screen
- [ ] File is `.mp4`, 3–5 minutes, audio audible, and it plays back correctly
