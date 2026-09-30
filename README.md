# Deepak Suthar — Personal Portfolio

This is a personalized version of the included Jackson/Colorlib portfolio template.

## Run
For the public site only, open `index.html` directly in a browser. For the live admin system, use Node 22.5 or newer:

```powershell
npm run hash-password -- "choose-a-password"
$env:ADMIN_EMAIL="you@example.com"
$env:ADMIN_PASSWORD_HASH="paste-the-generated-hash"
npm start
```

Then open `http://localhost:3000/admin`. The first server start creates `data/deepak.sqlite` and seeds the current portfolio sections. Do not commit the database or password hash.

## Deploy the live admin for free

GitHub Pages only serves static files, so the API runs as a Cloudflare Worker and stores persistent data in Cloudflare D1. The free plan has usage limits; consult Cloudflare's current limits before launch.

1. Sign in to a Cloudflare account and install Node.js 22.5 or newer.
2. From this project folder, run `npx wrangler login` and `npx wrangler d1 create deepak-portfolio-db`.
3. Copy the database ID from the command output into `database_id` in `wrangler.jsonc`, replacing `REPLACE_WITH_D1_DATABASE_ID`.
4. Apply the schema with `npx wrangler d1 migrations apply deepak-portfolio-db --remote`.
5. Add the admin password as a Cloudflare secret with `npx wrangler secret put ADMIN_PASSWORD`. Enter a new strong password directly in the terminal prompt—never put it in source code, chat, or a committed file.
6. Deploy with `npx wrangler deploy`. Copy the HTTPS `workers.dev` URL it prints into `window.DEEPAK_API_BASE` in `js/api-config.js` (without a trailing slash).
7. After the API URL is configured and tested, publish the changes to GitHub Pages and sign in at `https://deepakxsuthar-glitch.github.io/deepak/admin/` using `deepakxsuthar@gmail.com` and the secret password.

The Worker uses bearer sessions rather than cross-site cookies, and only accepts browser requests from the configured GitHub Pages origin. D1 keeps saved admin content, contact messages, events, and analytics between Worker runs.

The server provides persistent storage, cookie sessions, CSRF protection for writes, public page-view tracking, contact-message storage, audit events, CMS editing, and an SSE activity stream. For a static GitHub Pages frontend, set its API URL in `js/api-config.js` so tracking, contact submissions, and CMS hydration reach the hosted Node server.

## Admin scope and production notes

Implemented now: protected `/admin`, admin login/logout, content editing and publishing, message inbox/status changes, visitor/page-view events, real local analytics for page views, top pages, devices, browsers and daily traffic, live SSE activity, system health checks, audit events, public content hydration, and responsive dashboard layout.

Displayed as `Unavailable` until configured: external analytics provider, geographic enrichment, deployment history, backups, media storage, error aggregation, and multi-admin roles. Local analytics are real but only include page views received by this server; no external provider or invented values are used. For production, place the server behind HTTPS, use a managed PostgreSQL-compatible database and object storage, set secure environment secrets, configure a reverse proxy, and add an email provider/rate-limit store before exposing the contact endpoint publicly.

## Before publishing
1. Replace `YOUR_EMAIL@example.com` in `index.html` with your real email address.
2. Replace any project `href="#"` links with the real live-demo/repository URLs when available.
3. Replace the visual progress levels in the Skills section with your preferred self-assessment.
4. Add your own profile photo later if you want one; the current sidebar uses a `DS` monogram so the site never presents a stock image as you.

## Main sections
Home · About · What I Build · Skills · Education · Journey · Projects · Notes · Contact
