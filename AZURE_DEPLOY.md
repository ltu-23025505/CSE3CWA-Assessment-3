# Azure App Service deployment runbook

Every step below was chosen because Azure for Students requires **no credit card**. Work top to
bottom; steps 1–4 can be done while the application is still being finished.

Budget about 40 minutes, including the first deploy.

---

## 0. What you need first

- An **Azure for Students** subscription (sign up at `azure.microsoft.com/free/students` with your
  university email — no card required).
- The project pushed to a **GitHub** repository.
- Your GitHub OAuth App **Client ID** and **Client Secret** to hand.

---

## 1. Push the project to GitHub

```bash
cd ai-capsule
git add .
git commit -m "AI Capsule: full-stack prompt manager with OAuth, JWT and SQLite"
gh repo create ai-capsule --public --source=. --push
```

Or create the repository in the GitHub UI and:

```bash
git remote add origin https://github.com/<username>/ai-capsule.git
git branch -M main
git push -u origin main
```

**Before pushing, confirm no secrets are included:**

```bash
git status --short          # backend/.env must NOT appear
git grep -n "GITHUB_CLIENT_SECRET\|JWT_SECRET=" $(git rev-parse HEAD) -- . || echo "clean"
```

`.gitignore` already excludes `backend/.env` and `backend/data/`.

---

## 2. Create the Web App

1. Sign in to the **Azure Portal** (`portal.azure.com`) and confirm the subscription is
   *Azure for Students*.
2. **Create a resource → Web App**.
3. Fill in:

| Field | Value |
|---|---|
| Subscription | Azure for Students |
| Resource group | `ai-capsule-rg` (create new) |
| Name | `ai-capsule-<yourname>` → becomes `ai-capsule-<yourname>.azurewebsites.net` |
| Publish | **Code** |
| Runtime stack | **Node 22 LTS** |
| Operating System | **Linux** |
| Region | Australia East (or nearest) |
| Pricing plan | **Free F1**. If F1 is unavailable in the region, use **Basic B1** — the $100 student credit covers it |

4. **Review + create → Create**, then wait for the deployment to finish.

> The F1 plan has a daily CPU quota. It is enough for marking, but if the app starts returning 503
> under repeated load, change the App Service Plan to B1 (Scale up).

---

## 3. Add the application settings

**Web App → Settings → Environment variables → App settings → + Add** (one row each):

| Name | Value |
|---|---|
| `JWT_SECRET` | a long random string — generate with the command below |
| `GITHUB_CLIENT_ID` | your OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | your OAuth App client secret |
| `NODE_ENV` | `production` |
| `DATABASE_PATH` | `/home/data/capsules.db` |

Generate the secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

`DATABASE_PATH` matters: App Service's `/home` mount is **persistent**, whereas anything inside the
deployed `wwwroot` can be replaced by a redeploy. `NODE_ENV=production` is what makes the session
cookie `Secure`.

Then **Apply** (the app restarts).

---

## 4. Set the startup command

**Web App → Settings → Configuration → Startup Command**:

```
node backend/server.js
```

Save. App Service runs `npm install` and then `npm run build` from the repository root on each
deploy; the root `package.json` `build` script installs `backend/` and `frontend/` and builds the
React app into `frontend/dist`, which Express then serves.

Leave **WEBSITES_PORT** unset — App Service injects `PORT` and the server reads it.

---

## 5. Connect the GitHub repository

**Web App → Deployment → Deployment Center**:

1. **Source: GitHub** → Authorise if prompted.
2. Choose the organisation/account, the `ai-capsule` repository and the `main` branch.
3. **Save**. Azure adds a GitHub Actions workflow and starts the first deployment.

Or skip the Portal and deploy with the Azure CLI:

```bash
az login
az webapp up --name ai-capsule-<yourname> --resource-group ai-capsule-rg --runtime "NODE:22-lts"
```

Watch progress under **Deployment → Deployment Center → Logs**. The first build takes a few minutes.
If the site loads but the pages 404, the frontend build did not run — check the build log for the
`npm run build` step.

---

## 6. Register the production callback URL

The OAuth callback URL is derived from the incoming host, so Azure needs no extra setting — but
GitHub must be told to accept it.

**GitHub → Settings → Developer settings → OAuth apps → AI Capsule → Edit**:

- **Homepage URL**: `https://ai-capsule-<yourname>.azurewebsites.net`
- **Authorization callback URL** — click **Add callback URL** and keep the localhost one:

```
http://localhost:5173/auth/github/callback
https://ai-capsule-<yourname>.azurewebsites.net/auth/github/callback
```

Update the application. **Leave wildcard matching disabled** — exact matching only.

> `localhost:5173` (the Vite dev server) is the development callback. In production the callback is
> the Azure host directly, because Express serves the frontend and the API from one origin.

---

## 7. Verify the deployment

```bash
APP=https://ai-capsule-<yourname>.azurewebsites.net

curl -i $APP/api/health
# expect: HTTP/2 200   and   {"status":"ok"}

curl -i $APP/api/capsules
# expect: HTTP/2 401   and   {"error":"Unauthorized"}       <- Test 1

curl -i -H "Cookie: token=fake-token-123" $APP/api/capsules
# expect: HTTP/2 401   and   {"error":"Unauthorized"}       <- Test 2
```

Then in a browser:

1. Open `$APP` — the landing page loads over HTTPS and the URL is **not** localhost.
2. **Continue with GitHub** → authorise → you land on `/dashboard`.
3. Create a capsule, edit it, delete it.
4. Reload — the record you created is still there (persistence).
5. Sign out, then open `$APP/dashboard` directly — you are sent to `/login`.

If sign-in succeeds but every API call returns 401, `NODE_ENV=production` is set without
`trust proxy` working, or the cookie is being rejected — check that the URL is `https://` and that
`DATABASE_PATH` is set.

---

## 8. Show the cloud configuration in the video

For the "cloud runtime/settings" evidence, record:

- The Portal **Overview** blade showing the resource name, region and the `*.azurewebsites.net` URL.
- **Environment variables** listing the setting **names** (click the eye icon only if you want to
  prove a value exists — do **not** reveal secret values).
- **Configuration → Startup Command**.
- **Deployment Center** showing the successful GitHub deployment.

---

## 9. Before submitting

- [ ] Deployed URL opens over HTTPS and is not localhost
- [ ] `/api/health` returns `{"status":"ok"}`
- [ ] Both cURL tests return `401`
- [ ] GitHub sign-in reaches the dashboard
- [ ] CREATE, READ, UPDATE, DELETE all work on the deployed URL and survive a reload
- [ ] `git status` shows no `backend/.env`, no `node_modules`, no `*.db`
- [ ] README's deployed URL is updated to the real one
- [ ] ZIP contains no `node_modules`, no `frontend/dist`, no database file
- [ ] Video is `.mp4`, 3–5 minutes, audio working

## 10. Keep it alive

The brief requires the application to stay available through the marking period. Two things can
undermine that:

- **The free plan can idle.** The first request after a quiet period may take a few seconds to wake
  the instance. That is acceptable, but open the app shortly before marking if you can.
- **Account access.** If your GitHub account is institution-issued, make sure you will still have
  access to it (and therefore to this repository and the OAuth App) until marking is complete.
