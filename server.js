const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const ROOT = __dirname;
const ENV_PATH = path.join(ROOT, '.env');
if (fs.existsSync(ENV_PATH)) process.loadEnvFile(ENV_PATH);
const PORT = Number(process.env.PORT || 3000);
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'data', 'deepak.sqlite');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@localhost';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '';
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'https://deepakxsuthar-glitch.github.io';
const COOKIE_ATTRIBUTES = process.env.NODE_ENV === 'production' ? 'SameSite=None; Secure' : 'SameSite=Strict';
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;
const sessions = new Map();
const subscribers = new Set();

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const database = new DatabaseSync(DB_PATH);
database.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS content (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    section TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    enabled INTEGER NOT NULL DEFAULT 1,
    published INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    detail TEXT NOT NULL,
    category TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS visitors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    page TEXT NOT NULL,
    user_agent TEXT NOT NULL,
    last_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id)
  );
  CREATE TABLE IF NOT EXISTS page_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    page TEXT NOT NULL,
    device TEXT NOT NULL,
    browser TEXT NOT NULL,
    referrer TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const contentSeed = [
  ['hero', 'Hi! I am Deepak', 'BCA student and self-taught developer building with AI, web, automation and creative technology.'],
  ['about', 'Who is Deepak?', 'A BCA student and self-taught developer from Rajasthan, India.'],
  ['services', 'Things I enjoy working on', 'AI assistants, web experiences, automation, UI/UX, programming and digital systems.'],
  ['skills', 'Skills I am building', 'HTML / CSS, JavaScript, Python, Git / GitHub, AI Tools & APIs, and UI / UX.'],
  ['education', 'Learning Journey', 'Bachelor of Computer Applications (BCA), currently in progress.'],
  ['experience', 'What I am working toward', 'Full-stack development, AI and agent systems, and portfolio UI systems.'],
  ['projects', 'Things I have been building', 'ASTRAX, JARVIS v2, Deepak Digital Identity, Agent Automation, Full-stack Practice, and Interface Experiments.'],
  ['notes', 'What I am learning', 'Building useful AI agents, learning full-stack by building, and designing interfaces with personality.'],
  ['contact', 'Let us connect', 'Open to learning, collaboration, freelance experiments, and entry-level opportunities.']
];
const seed = database.prepare('INSERT OR IGNORE INTO content (section, title, body) VALUES (?, ?, ?)');
for (const item of contentSeed) seed.run(...item);

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}
function verifyPassword(password, encoded) {
  if (!encoded || !encoded.startsWith('scrypt:')) return false;
  const [, salt, expected] = encoded.split(':');
  const actual = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}
function parseCookies(request) {
  return Object.fromEntries((request.headers.cookie || '').split(';').filter(Boolean).map((part) => {
    const index = part.indexOf('=');
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }));
}
function json(response, status, payload, extraHeaders = {}) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders });
  response.end(JSON.stringify(payload));
}
function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => { body += chunk; if (body.length > 1024 * 1024) request.destroy(); });
    request.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error('Invalid JSON')); } });
    request.on('error', reject);
  });
}
function event(type, detail, category) {
  const record = database.prepare('INSERT INTO events (type, detail, category) VALUES (?, ?, ?) RETURNING *').get(type, detail, category);
  const payload = `data: ${JSON.stringify(record)}\n\n`;
  for (const subscriber of subscribers) subscriber.write(payload);
  return record;
}
function clientProfile(userAgent) {
  const browser = /Edg\//.test(userAgent) ? 'Edge' : /Chrome\//.test(userAgent) ? 'Chrome' : /Firefox\//.test(userAgent) ? 'Firefox' : /Safari\//.test(userAgent) ? 'Safari' : 'Other';
  const device = /mobile|android|iphone|ipad/i.test(userAgent) ? 'Mobile' : 'Desktop';
  return { browser, device };
}
function analytics() {
  const totals = database.prepare(`SELECT COUNT(*) pageViews, COUNT(DISTINCT session_id) visitors, COUNT(DISTINCT CASE WHEN created_at >= datetime('now', '-7 days') THEN session_id END) weeklyVisitors, COUNT(CASE WHEN created_at >= datetime('now', '-7 days') THEN 1 END) weeklyPageViews FROM page_views`).get();
  const topPages = database.prepare(`SELECT page, COUNT(*) views, COUNT(DISTINCT session_id) uniqueVisitors FROM page_views GROUP BY page ORDER BY views DESC LIMIT 10`).all();
  const devices = database.prepare('SELECT device, COUNT(*) views FROM page_views GROUP BY device ORDER BY views DESC').all();
  const browsers = database.prepare('SELECT browser, COUNT(*) views FROM page_views GROUP BY browser ORDER BY views DESC').all();
  const daily = database.prepare(`SELECT substr(created_at, 1, 10) day, COUNT(*) views, COUNT(DISTINCT session_id) visitors FROM page_views WHERE created_at >= datetime('now', '-30 days') GROUP BY day ORDER BY day`).all();
  return { totals, topPages, devices, browsers, daily, source: 'local page-view database' };
}
function auth(request, response) {
  const token = parseCookies(request).admin_session;
  const session = sessions.get(token);
  if (!session || session.expires < Date.now()) {
    json(response, 401, { error: 'Authentication required' });
    return null;
  }
  return session;
}
function csrf(request, response) {
  const token = parseCookies(request).admin_csrf;
  if (!token || token !== request.headers['x-csrf-token']) {
    json(response, 403, { error: 'CSRF validation failed' });
    return false;
  }
  return true;
}
function publicFile(request, response, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.resolve(ROOT, `.${requested}`);
  const relativePath = path.relative(ROOT, filePath);
  const normalizedRelativePath = relativePath.split(path.sep).join('/').toLowerCase();
  const topLevel = normalizedRelativePath.split('/')[0];
  const publicAsset = normalizedRelativePath === 'index.html' || ['admin', 'css', 'fonts', 'images', 'js'].includes(topLevel);
  if (!publicAsset || relativePath.startsWith('..') || path.isAbsolute(relativePath) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return false;
  const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2' };
  response.writeHead(200, { 'Content-Type': `${types[path.extname(filePath)] || 'application/octet-stream'}; charset=utf-8` });
  fs.createReadStream(filePath).pipe(response);
  return true;
}
async function route(request, response) {
  const origin = request.headers.origin;
  if (origin === FRONTEND_ORIGIN) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Vary', 'Origin');
  }
  if (request.method === 'OPTIONS') {
    if (origin !== FRONTEND_ORIGIN) return json(response, 403, { error: 'Origin not allowed' });
    response.writeHead(204, {
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-CSRF-Token',
      'Access-Control-Max-Age': '600'
    });
    return response.end();
  }
  const url = new URL(request.url, `http://${request.headers.host}`);
  const { pathname } = url;
  if (request.method === 'GET' && pathname === '/api/health') {
    database.prepare('SELECT 1').get();
    return json(response, 200, { status: 'online', database: 'connected', realtime: 'available', environment: process.env.NODE_ENV || 'development', uptimeSeconds: Math.floor(process.uptime()) });
  }
  if (request.method === 'GET' && pathname === '/api/content') return json(response, 200, database.prepare(`SELECT section, enabled, published, CASE WHEN enabled=1 AND published=1 THEN title ELSE '' END title, CASE WHEN enabled=1 AND published=1 THEN body ELSE '' END body FROM content ORDER BY id`).all());
  if (request.method === 'POST' && pathname === '/api/track') {
    const body = await readBody(request);
    const sessionId = String(body.sessionId || crypto.randomUUID()).slice(0, 80);
    const page = String(body.page || '/').slice(0, 200);
    const userAgent = String(request.headers['user-agent'] || '').slice(0, 300);
    const profile = clientProfile(userAgent);
    database.prepare('INSERT INTO visitors (session_id, page, user_agent) VALUES (?, ?, ?) ON CONFLICT(session_id) DO UPDATE SET page=excluded.page, user_agent=excluded.user_agent, last_seen=CURRENT_TIMESTAMP').run(sessionId, page, userAgent);
    database.prepare('INSERT INTO page_views (session_id, page, device, browser, referrer) VALUES (?, ?, ?, ?, ?)').run(sessionId, page, profile.device, profile.browser, String(request.headers.referer || '').slice(0, 500));
    event('Page viewed', page, 'visitors');
    return json(response, 202, { sessionId });
  }
  if (request.method === 'POST' && pathname === '/api/contact') {
    const body = await readBody(request);
    const name = String(body.name || '').trim().slice(0, 120);
    const email = String(body.email || '').trim().slice(0, 200);
    const subject = String(body.subject || '').trim().slice(0, 200);
    const message = String(body.message || '').trim().slice(0, 5000);
    if (!name || !/^\S+@\S+\.\S+$/.test(email) || !subject || !message) return json(response, 400, { error: 'Name, valid email, subject and message are required' });
    database.prepare('INSERT INTO messages (name, email, subject, message) VALUES (?, ?, ?, ?)').run(name, email, subject, message);
    event('New message received', `From ${name}: ${subject}`, 'messages');
    return json(response, 201, { ok: true });
  }
  if (request.method === 'POST' && pathname === '/api/admin/login') {
    const body = await readBody(request);
    if (!verifyPassword(String(body.password || ''), ADMIN_PASSWORD_HASH) || String(body.email || '').toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      event('Failed login attempt', 'Invalid admin credentials', 'security');
      return json(response, 401, { error: 'Invalid credentials' });
    }
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const csrfToken = crypto.randomBytes(24).toString('hex');
    sessions.set(sessionToken, { email: ADMIN_EMAIL, csrfToken, expires: Date.now() + SESSION_TTL_MS });
    event('Admin logged in', ADMIN_EMAIL, 'admin');
    return json(response, 200, { ok: true, csrfToken }, { 'Set-Cookie': [`admin_session=${sessionToken}; HttpOnly; ${COOKIE_ATTRIBUTES}; Path=/; Max-Age=28800`, `admin_csrf=${csrfToken}; ${COOKIE_ATTRIBUTES}; Path=/; Max-Age=28800`] });
  }
  if (request.method === 'POST' && pathname === '/api/admin/logout') {
    const session = auth(request, response); if (!session) return;
    if (!csrf(request, response)) return;
    const token = parseCookies(request).admin_session; sessions.delete(token); event('Admin logged out', session.email, 'admin');
    return json(response, 200, { ok: true }, { 'Set-Cookie': [`admin_session=; HttpOnly; ${COOKIE_ATTRIBUTES}; Path=/; Max-Age=0`, `admin_csrf=; ${COOKIE_ATTRIBUTES}; Path=/; Max-Age=0`] });
  }
  if (pathname.startsWith('/api/admin/')) {
    const session = auth(request, response); if (!session) return;
    if (request.method !== 'GET' && !csrf(request, response)) return;
    if (request.method === 'GET' && pathname === '/api/admin/bootstrap') {
      const counts = database.prepare(`SELECT (SELECT COUNT(*) FROM visitors) visitors, (SELECT COUNT(*) FROM messages WHERE status='new') unreadMessages, (SELECT COUNT(*) FROM content WHERE enabled=1 AND published=1) publishedSections`).get();
      return json(response, 200, { session: { email: session.email, csrfToken: session.csrfToken }, counts, analytics: analytics(), content: database.prepare('SELECT * FROM content ORDER BY id').all(), events: database.prepare('SELECT * FROM events ORDER BY id DESC LIMIT 50').all(), messages: database.prepare('SELECT * FROM messages ORDER BY id DESC LIMIT 50').all(), visitors: database.prepare("SELECT * FROM visitors WHERE last_seen >= datetime('now', '-30 minutes') ORDER BY last_seen DESC").all() });
    }
    if (request.method === 'GET' && pathname === '/api/admin/events') return json(response, 200, database.prepare('SELECT * FROM events ORDER BY id DESC LIMIT 100').all());
    if (request.method === 'GET' && pathname === '/api/admin/stream') {
      response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' }); response.write(': connected\n\n'); subscribers.add(response); request.on('close', () => subscribers.delete(response)); return;
    }
    const contentMatch = pathname.match(/^\/api\/admin\/content\/([a-z-]+)$/);
    if (request.method === 'PUT' && contentMatch) {
      const body = await readBody(request); const section = contentMatch[1];
      const title = String(body.title || '').trim().slice(0, 200);
      const text = String(body.body || '').trim().slice(0, 10000);
      if (!title) return json(response, 400, { error: 'A section title is required' });
      const result = database.prepare('UPDATE content SET title=?, body=?, enabled=?, published=?, updated_at=CURRENT_TIMESTAMP WHERE section=?').run(title, text, body.enabled === true ? 1 : 0, body.published === true ? 1 : 0, section);
      if (!result.changes) return json(response, 404, { error: 'Content section not found' });
      event('Content updated', section, 'content'); return json(response, 200, database.prepare('SELECT * FROM content WHERE section=?').get(section));
    }
    if (request.method === 'PATCH' && pathname.match(/^\/api\/admin\/messages\/\d+$/)) {
      const id = Number(pathname.split('/').pop()); const body = await readBody(request);
      const allowedStatuses = new Set(['new', 'read', 'replied', 'archived']);
      if (!allowedStatuses.has(body.status)) return json(response, 400, { error: 'Invalid message status' });
      const result = database.prepare('UPDATE messages SET status=? WHERE id=?').run(body.status, id);
      if (!result.changes) return json(response, 404, { error: 'Message not found' });
      event('Message status updated', String(id), 'messages'); return json(response, 200, { ok: true });
    }
    return json(response, 404, { error: 'Admin endpoint not found' });
  }
  if (request.method === 'GET' && pathname === '/admin') {
    response.writeHead(301, { Location: '/admin/' }); return response.end();
  }
  if (request.method === 'GET' && pathname === '/admin/') {
    const html = fs.readFileSync(path.join(ROOT, 'admin', 'index.html')); response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return response.end(html);
  }
  if (request.method === 'GET' && publicFile(request, response, pathname)) return;
  json(response, 404, { error: 'Not found' });
}

if (process.argv.includes('--hash-password')) {
  const password = process.argv[process.argv.indexOf('--hash-password') + 1];
  if (!password) { console.error('Usage: npm run hash-password -- your-password'); process.exit(1); }
  console.log(hashPassword(password));
  process.exit(0);
}

http.createServer((request, response) => route(request, response).catch((error) => { console.error(error); json(response, 500, { error: 'Internal server error' }); })).listen(PORT, () => console.log(`Deepak Digital Identity running at http://localhost:${PORT}`));
