# RITMOF

A gamified life companion PWA for STEM university students. Solo Leveling RPG aesthetic. Black and white. No server — runs entirely in your browser.

---

## Deploy: GitHub Pages (recommended, free)

**Checklist:** Push repo → enable Pages from GitHub Actions → (optional) add repo Variables for single-account gate and/or device lock → push again if you added Variables.

### 1 — Push to GitHub

```bash
git init
git add .
git commit -m "init"
git remote add origin https://github.com/YOUR_USERNAME/ritmof.git
git push -u origin main
```

**If you rewrote history** (e.g. to remove a committed secret): use `git push --force origin main` so the remote matches your cleaned history. Only force-push when you’re sure no one else is building on the old history.

### 2 — Enable GitHub Pages

1. Go to your repo → **Settings → Pages**
2. Under **Build and deployment**, set **Source** to **GitHub Actions** (not “Deploy from a branch”).
3. The workflow at `.github/workflows/deploy.yml` runs automatically on every push to `main`

**If the page is blank and the console shows**  
`Loading module from ".../src/App.jsx" was blocked because of a disallowed MIME type ("text/html")`  
→ The site is serving the repo source instead of the built app. Fix: set **Source** to **GitHub Actions** (step 2 above), then push a commit so the workflow runs and deploys the `dist` folder.

### 3 — Base path

The workflow sets `VITE_BASE_PATH` from your repo name automatically, so the app is served at `https://YOUR_USERNAME.github.io/REPO_NAME/`. No change needed.

### 4 — (Optional) Single-account gate

You can restrict the app to a single Google account (e.g. only you can sign in). To enable it on the **deployed** site:

1. Repo → **Settings** → **Secrets and variables** → **Actions** → **Variables** → **New repository variable**.
2. Add:
   - `VITE_ALLOWED_EMAIL` = the one Google email allowed (e.g. `you@gmail.com`)
   - `VITE_GOOGLE_CLIENT_ID` = your Google OAuth Client ID (Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID). Add your GitHub Pages URL to **Authorized JavaScript origins**.
3. Push a commit so the workflow rebuilds with these variables.

For **local dev**, set the same in `.env` (see `.env.example`). Leave both empty to disable the gate.



### 5 — (Optional) Device lock (password gate)

The app can show a password screen on first open. The password is never stored; only a hash is kept. Users enter the password once per device; access is remembered until you change the hash (e.g. when you set a new password).

**Security:** The device-lock hash is read from **environment variables**, not from source code. This keeps the hash out of the repo and avoids leaking it in git history. **Never commit the hash** — use a `.env` file (see below) and ensure `.env` is in `.gitignore` (it is in this repo).

**How to set or change the password:**

1. Generate the hash in Terminal (replace `YourPassword` with your actual password):
   ```bash
   node -e "const c=require('crypto');console.log(c.pbkdf2Sync('YourPassword','ritmof-device-lock-v1',1e5,32,'sha256').toString('hex'));"
   ```

2. Put that hash in **two places** (same value both times):
   - **Here (local):** In a `.env` file in the project root. Create it if needed (see `.env.example`). Add:
     ```
     VITE_DEVICE_LOCK_HASH=<paste the hex output>
     ```
     Used when you run `npm run dev` or `npm run build` on your machine. Never commit `.env` (it’s in `.gitignore`).
   - **GitHub (deployed site):** Repo → **Settings** → **Secrets and variables** → **Actions** → **Variables** → **New repository variable**. Name: `VITE_DEVICE_LOCK_HASH`, Value: the same hex string. Used when GitHub Actions builds the app for GitHub Pages.

3. Rebuild and redeploy. For the live site, push a commit so the workflow runs with the new variable. When the hash changes, all devices will be asked for the (new) password again.

---

## Dropbox Sync

1. [dropbox.com/developers/apps](https://www.dropbox.com/developers/apps) → Create app → Scoped → App folder
2. Permissions: enable `files.content.read` + `files.content.write` → Submit
3. Settings → Redirect URIs → add your deployed URL (and `http://localhost:5173`)
4. Copy the **App Key**
5. RITMOF → Profile → Settings → paste App Key → **CONNECT DROPBOX**

---

## Local Dev

Create a `.env` file in the project root for secrets (e.g. `VITE_DEVICE_LOCK_HASH`, `VITE_GOOGLE_CLIENT_ID`, `VITE_ALLOWED_EMAIL`). `.env` is in `.gitignore` — never commit it.

```bash
npm install
npm run dev   # → http://localhost:5173
```

**Dev mode protects your real data:** When you run `npm run dev`, the app uses a **separate localStorage copy** (keys prefixed with `ritmof_dev_`). It will **pull** from Dropbox on launch (if connected) and store that data in this local copy. The app **never pushes to Dropbox** in dev, so you can experiment without affecting your real synced data. A yellow “DEV MODE” bar at the top reminds you. Use the sync button in dev to **refresh** the local copy from Dropbox (pull only).
