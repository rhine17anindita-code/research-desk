# Deploying to Hostinger

Research Desk runs as a Node.js web app. On Hostinger that needs a **Business web hosting** or **Cloud** plan (Single/Premium plans don't run Node.js apps). Every push to the `main` branch on GitHub redeploys the site automatically.

## 1. Create the web app

1. In Hostinger, go to **Websites → Create site → Web App**.
2. Pick your domain or a subdomain (e.g. `research.yourdomain.com`), or **Use temporary domain** to start. Click **Next**.
3. Choose **Import your Git repository → Continue with GitHub**, authorise if asked, and select **research-desk**.
4. **Build configuration**
   - Framework preset: **Next.js**
   - Node version: **22.x** or **24.x** (not 20.x: the SQLite driver needs Node 22+)
   - Root directory: `/` · Branch: `main`
   - Package manager: **npm** · Build command: `npm run build` (start command, if asked: `npm start`)

## 2. Environment variables

Add these under **Environment Variables** before deploying:

| Name | Value | |
|---|---|---|
| `SITE_PASSWORD` | a long password you choose | **Required.** Without it the site stays locked. Share it only with people who should have full access. |
| `INGEST_INTERVAL_MINUTES` | `15` | Optional starting value for automatic feed checks; change it any time from the Studio (that choice wins). |
| `YOUTUBE_API_KEY` | your key | Your own YouTube numbers and comments, talk-show views, reference creators. |
| `META_ACCESS_TOKEN` | your Meta token | Instagram & Facebook numbers for every channel. Lasts ~60 days; the Performance page warns before it expires. |
| `ANTHROPIC_API_KEY` | your key | Optional; enables AI features. Budgets in Settings still apply. |
| `SESSION_SECRET` | another long random string | Optional; changing it signs everyone out. |
| `DATABASE_PATH` | leave empty | Optional. By default the app stores its database at `~/research-desk-data/research-desk.db`, outside the folder Hostinger replaces on every deploy, so your research survives updates. |

Click **Deploy** and watch the build log. When it finishes, open the app link, sign in with your password, and press **Refresh feeds** on Discover (the hourly refresh also starts on its own shortly after the first visit).

## 3. Updating

Changes pushed to `main` on GitHub redeploy automatically. Your data is not touched by redeploys. To change a secret, edit the environment variable and use **Restart** (or redeploy).

## Notes and limits

- **One process:** the app is a single server with a local SQLite database. That suits one person or a small trusted group sharing one password; there are no individual accounts yet.
- **Backups:** download `~/research-desk-data/research-desk.db` from File Manager now and then.
- **If the build fails on `better-sqlite3`:** the host could not install the SQLite driver's prebuilt binary. Send the build log to Claude; the fallback is switching the driver to Node's built-in SQLite.
- **Anyone with the password** can edit everything, add feeds and spend the AI budget. Keep budgets in Settings → AI & usage modest.
