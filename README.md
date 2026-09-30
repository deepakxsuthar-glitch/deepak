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

## Deploy the live admin

The GitHub Pages site is static, so the admin API must run as a separate Node.js service. This repository includes a Render Blueprint in `render.yaml`; it configures the Node server and persistent SQLite storage. The Blueprint uses a paid web service and persistent disk, so check Render's current pricing before creating it.

1. In Render, create a new **Blueprint** from this GitHub repository and deploy `render.yaml`.
2. Generate a fresh password hash locally with `npm run hash-password -- "choose-a-new-strong-password"`. Enter that hash as the secret `ADMIN_PASSWORD_HASH` when Render prompts for it. Do not reuse a password posted in chat, and never commit the hash or raw password.
3. After Render gives the service URL, set `window.DEEPAK_API_BASE` in `js/api-config.js` to that HTTPS URL (no trailing slash), then commit and push the change so GitHub Pages publishes it.
4. Open `https://deepakxsuthar-glitch.github.io/deepak/admin/` and sign in with the configured `ADMIN_EMAIL` and the new password.

The service allows API requests only from this GitHub Pages origin. The browser must allow cross-site cookies for login sessions; if they are blocked by privacy settings, a custom domain/reverse proxy on the same site is needed.

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
