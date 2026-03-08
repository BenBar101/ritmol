# RITMOF

A gamified life companion PWA for STEM university students. Solo Leveling RPG aesthetic. Black and white. No server — runs entirely in your browser.

**Access control:** The app is single-user. Only the Google account set in `ALLOWED_EMAIL` can use the app. Set this in your environment (e.g. `.env` or GitHub Actions Variables) and never commit secrets. The app expects **Google OAuth Client ID**, **Gemini API key** (`VITE_GEMINI_API_KEY`), and **Dropbox App Key** (`VITE_DROPBOX_APP_KEY`) to be set as **GitHub repo Variables** (or `.env` locally). Keys are not optional and are not entered in the UI — see `.env.example` and the deploy section.

---

## After cloning

1. **Clone and enter the repo**
   ```bash
   git clone https://github.com/YOUR_USERNAME/ritmof.git
   cd ritmof
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run locally**
   ```bash
   npm run dev
   ```
   Opens at `http://localhost:5173`. For single-account access, set `VITE_ALLOWED_EMAIL` and `VITE_GOOGLE_CLIENT_ID` in `.env` (see below). Example in docs uses a dummy email — use your own Google email in real config.

4. **Required: local `.env`**  
   Copy `.env.example` to `.env` and set `VITE_ALLOWED_EMAIL`, `VITE_GOOGLE_CLIENT_ID`, `VITE_GEMINI_API_KEY`, and `VITE_DROPBOX_APP_KEY`. Use a dummy email in documentation examples; never put real secrets in the repo.

---

## Deploy: GitHub Pages (recommended, free)

**Checklist:** Push repo → enable Pages from GitHub Actions → add **GitHub repo Variables** for `VITE_ALLOWED_EMAIL`, `VITE_GOOGLE_CLIENT_ID`, `VITE_GEMINI_API_KEY`, and `VITE_DROPBOX_APP_KEY` (and optionally a JWT verification endpoint URL if you add a backend).

**Live site config:** Set `VITE_ALLOWED_EMAIL`, `VITE_GOOGLE_CLIENT_ID`, `VITE_GEMINI_API_KEY`, and `VITE_DROPBOX_APP_KEY` under **Settings → Secrets and variables → Actions → Variables**. No `.env` file is used for the deployed build.

### 1 — Push to GitHub

```bash
git init
git add .
git commit -m "init"
git remote add origin https://github.com/YOUR_USERNAME/ritmof.git
git push -u origin main
```

**If you rewrote history** (e.g. to remove a committed secret): use `git push --force origin main` so the remote matches your cleaned history. Only force-push when you're sure no one else is building on the old history.

### 2 — Enable GitHub Pages

1. Go to your repo → **Settings → Pages**
2. Under **Build and deployment**, set **Source** to **GitHub Actions** (not "Deploy from a branch").
3. The workflow at `.github/workflows/deploy.yml` runs automatically on every push to `main`

**If the page is blank and the console shows**  
`Loading module from ".../src/App.jsx" was blocked because of a disallowed MIME type ("text/html")`  
→ The site is serving the repo source instead of the built app. Fix: set **Source** to **GitHub Actions** (step 2 above), then push a commit so the workflow runs and deploys the `dist` folder.

### 3 — Base path

The workflow sets `VITE_BASE_PATH` from your repo name automatically, so the app is served at `https://YOUR_USERNAME.github.io/REPO_NAME/`. No change needed.

### 4 — Restrict access (single Google account)

Only the Google account in `VITE_ALLOWED_EMAIL` can use the app.

1. Add **GitHub repository variables** (Settings → Secrets and variables → Actions → Variables):
   - `VITE_ALLOWED_EMAIL`: your Google account email (e.g. `you@gmail.com`)
   - `VITE_GOOGLE_CLIENT_ID`: your Google OAuth Client ID (Web application, with your GitHub Pages URL in Authorized JavaScript origins)
   - `VITE_GEMINI_API_KEY`: your Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)
   - `VITE_DROPBOX_APP_KEY`: your Dropbox App Key from [dropbox.com/developers/apps](https://www.dropbox.com/developers/apps)

2. Push a commit so the workflow rebuilds. The app will show the Google sign-in gate; only the configured email can continue.

**Security note:** For production, add a small backend that verifies the Google ID token (JWT) and returns the email. Without server-side verification, a determined attacker could forge a token. The repo includes an example serverless function at `api/verify-google-id.js` (Vercel-style). Deploy it (e.g. to Vercel), set `GOOGLE_CLIENT_ID` in the function's environment, and set `VITE_VERIFY_GOOGLE_ID_URL` in your front-end env to the function URL. The client will then POST the credential there and only continue if the response email matches.

---

## Dropbox Sync

1. [dropbox.com/developers/apps](https://www.dropbox.com/developers/apps) → Create app → Scoped → App folder
2. Permissions: enable `files.content.read` + `files.content.write` → Submit
3. Settings → Redirect URIs → add your deployed URL (and `http://localhost:5173`)
4. Copy the **App Key** and set **`VITE_DROPBOX_APP_KEY`** in GitHub repo Variables (or `.env` locally). The app requires this variable; it does not accept the key in the UI. Then in the app: Profile → Settings → **CONNECT DROPBOX** (OAuth uses the key from env).

---

## Local Dev

The app requires `VITE_GEMINI_API_KEY` and `VITE_DROPBOX_APP_KEY` to be set (it shows a configuration screen otherwise). Run:

```bash
npm install
npm run dev   # → http://localhost:5173
```

To run with **single-account access** and **sync**, create a `.env` from `.env.example` and set `VITE_ALLOWED_EMAIL`, `VITE_GOOGLE_CLIENT_ID`, `VITE_GEMINI_API_KEY`, and `VITE_DROPBOX_APP_KEY`. The app will not run without these keys (it shows a configuration screen until they are set).

**Dev mode protects your real data:** When you run `npm run dev`, the app uses a **separate localStorage copy** (keys prefixed with `ritmof_dev_`). It will **pull** from Dropbox on launch (if connected) and store that data in this local copy. The app **never pushes to Dropbox** in dev, so you can experiment without affecting your real synced data. A yellow "DEV MODE" bar at the top reminds you. Use the sync button in dev to **refresh** the local copy from Dropbox (pull only).
