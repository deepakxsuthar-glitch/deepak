const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }
});

const toHex = (bytes) => [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, '0')).join('');
const fromHex = (value) => new Uint8Array((value.match(/.{1,2}/g) || []).map((part) => parseInt(part, 16)));
const randomToken = (size = 32) => toHex(crypto.getRandomValues(new Uint8Array(size)));
const digest = async (value) => toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
const safeEqual = (left, right) => {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  return difference === 0;
};

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  if (origin !== (env.FRONTEND_ORIGIN || 'https://deepakxsuthar-glitch.github.io')) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-CSRF-Token',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin'
  };
}

async function logEvent(env, type, detail, category) {
  await env.DB.prepare('INSERT INTO events (type, detail, category) VALUES (?, ?, ?)').bind(type, detail, category).run();
}

async function getSession(request, env) {
  const bearer = request.headers.get('Authorization') || '';
  const token = bearer.startsWith('Bearer ') ? bearer.slice(7) : '';
  if (!token) return null;
  return env.DB.prepare('SELECT email, csrf_hash FROM admin_sessions WHERE token_hash = ? AND expires_at > ?')
    .bind(await digest(token), Date.now()).first();
}

async function route(request, env) {
  const url = new URL(request.url);
  const { pathname } = url;
  if (request.method === 'OPTIONS') {
    const headers = corsHeaders(request, env);
    if (!headers['Access-Control-Allow-Origin']) return json({ error: 'Origin not allowed' }, 403);
    return new Response(null, { status: 204, headers });
  }

  const cors = corsHeaders(request, env);
  if (pathname === '/api/health' && request.method === 'GET') {
    await env.DB.prepare('SELECT 1').first();
    return json({ status: 'online', database: 'connected', realtime: 'polling', environment: 'production' }, 200, cors);
  }

  if (pathname === '/api/content' && request.method === 'GET') {
    const { results = [] } = await env.DB.prepare(`SELECT section, enabled, published,
      CASE WHEN enabled=1 AND published=1 THEN title ELSE '' END AS title,
      CASE WHEN enabled=1 AND published=1 THEN body ELSE '' END AS body
      FROM content ORDER BY id`).all();
    return json(results, 200, cors);
  }

  if (pathname === '/api/track' && request.method === 'POST') {
    const body = await request.json();
    const sessionId = String(body.sessionId || crypto.randomUUID()).slice(0, 80);
    const page = String(body.page || '/').slice(0, 200);
    const userAgent = String(request.headers.get('User-Agent') || '').slice(0, 300);
    const browser = /Edg\//.test(userAgent) ? 'Edge' : /Chrome\//.test(userAgent) ? 'Chrome' : /Firefox\//.test(userAgent) ? 'Firefox' : /Safari\//.test(userAgent) ? 'Safari' : 'Other';
    const device = /mobile|android|iphone|ipad/i.test(userAgent) ? 'Mobile' : 'Desktop';
    await env.DB.prepare(`INSERT INTO visitors (session_id, page, user_agent) VALUES (?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET page=excluded.page, user_agent=excluded.user_agent, last_seen=CURRENT_TIMESTAMP`).bind(sessionId, page, userAgent).run();
    await env.DB.prepare('INSERT INTO page_views (session_id, page, device, browser, referrer) VALUES (?, ?, ?, ?, ?)')
      .bind(sessionId, page, device, browser, String(request.headers.get('Referer') || '').slice(0, 500)).run();
    await logEvent(env, 'Page viewed', page, 'visitors');
    return json({ sessionId }, 202, cors);
  }

  if (pathname === '/api/contact' && request.method === 'POST') {
    const body = await request.json();
    const name = String(body.name || '').trim().slice(0, 120);
    const email = String(body.email || '').trim().slice(0, 200);
    const subject = String(body.subject || '').trim().slice(0, 200);
    const message = String(body.message || '').trim().slice(0, 5000);
    if (!name || !/^\S+@\S+\.\S+$/.test(email) || !subject || !message) return json({ error: 'Name, valid email, subject and message are required' }, 400, cors);
    await env.DB.prepare('INSERT INTO messages (name, email, subject, message) VALUES (?, ?, ?, ?)').bind(name, email, subject, message).run();
    await logEvent(env, 'New message received', `From ${name}: ${subject}`, 'messages');
    return json({ ok: true }, 201, cors);
  }

  if (pathname === '/api/admin/login' && request.method === 'POST') {
    const body = await request.json();
    const password = String(body.password || '');
    const email = String(body.email || '').toLowerCase();
    if (!env.ADMIN_PASSWORD || !safeEqual(password, env.ADMIN_PASSWORD) || email !== String(env.ADMIN_EMAIL || '').toLowerCase()) {
      await logEvent(env, 'Failed login attempt', 'Invalid admin credentials', 'security');
      return json({ error: 'Invalid credentials' }, 401, cors);
    }
    const token = randomToken();
    const csrfToken = randomToken(24);
    await env.DB.prepare('INSERT INTO admin_sessions (token_hash, csrf_hash, email, expires_at) VALUES (?, ?, ?, ?)')
      .bind(await digest(token), await digest(csrfToken), env.ADMIN_EMAIL, Date.now() + 8 * 60 * 60 * 1000).run();
    await logEvent(env, 'Admin logged in', env.ADMIN_EMAIL, 'admin');
    return json({ ok: true, token, csrfToken }, 200, cors);
  }

  if (pathname.startsWith('/api/admin/')) {
    const session = await getSession(request, env);
    if (!session) return json({ error: 'Authentication required' }, 401, cors);
    if (request.method !== 'GET') {
      const suppliedCsrf = request.headers.get('X-CSRF-Token') || '';
      if (!suppliedCsrf || !safeEqual(await digest(suppliedCsrf), session.csrf_hash)) return json({ error: 'CSRF validation failed' }, 403, cors);
    }

    if (pathname === '/api/admin/bootstrap' && request.method === 'GET') {
      const [counts, totals, topPages, devices, browsers, daily, content, events, messages, visitors] = await Promise.all([
        env.DB.prepare(`SELECT (SELECT COUNT(*) FROM visitors) AS visitors,
          (SELECT COUNT(*) FROM messages WHERE status='new') AS unreadMessages,
          (SELECT COUNT(*) FROM content WHERE enabled=1 AND published=1) AS publishedSections`).first(),
        env.DB.prepare(`SELECT COUNT(*) AS pageViews, COUNT(DISTINCT session_id) AS visitors,
          COUNT(DISTINCT CASE WHEN created_at >= datetime('now', '-7 days') THEN session_id END) AS weeklyVisitors,
          COUNT(CASE WHEN created_at >= datetime('now', '-7 days') THEN 1 END) AS weeklyPageViews FROM page_views`).first(),
        env.DB.prepare('SELECT page, COUNT(*) AS views, COUNT(DISTINCT session_id) AS uniqueVisitors FROM page_views GROUP BY page ORDER BY views DESC LIMIT 10').all(),
        env.DB.prepare('SELECT device, COUNT(*) AS views FROM page_views GROUP BY device ORDER BY views DESC').all(),
        env.DB.prepare('SELECT browser, COUNT(*) AS views FROM page_views GROUP BY browser ORDER BY views DESC').all(),
        env.DB.prepare(`SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS views, COUNT(DISTINCT session_id) AS visitors
          FROM page_views WHERE created_at >= datetime('now', '-30 days') GROUP BY day ORDER BY day`).all(),
        env.DB.prepare('SELECT * FROM content ORDER BY id').all(),
        env.DB.prepare('SELECT * FROM events ORDER BY id DESC LIMIT 50').all(),
        env.DB.prepare('SELECT * FROM messages ORDER BY id DESC LIMIT 50').all(),
        env.DB.prepare("SELECT * FROM visitors WHERE last_seen >= datetime('now', '-30 minutes') ORDER BY last_seen DESC").all()
      ]);
      return json({
        session: { email: session.email }, counts, analytics: {
          totals, topPages: topPages.results || [], devices: devices.results || [], browsers: browsers.results || [],
          daily: daily.results || [], source: 'Cloudflare D1 database'
        }, content: content.results || [], events: events.results || [], messages: messages.results || [], visitors: visitors.results || []
      }, 200, cors);
    }

    if (pathname === '/api/admin/events' && request.method === 'GET') {
      const { results = [] } = await env.DB.prepare('SELECT * FROM events ORDER BY id DESC LIMIT 100').all();
      return json(results, 200, cors);
    }

    const contentMatch = pathname.match(/^\/api\/admin\/content\/([a-z-]+)$/);
    if (request.method === 'PUT' && contentMatch) {
      const body = await request.json();
      const section = contentMatch[1];
      const title = String(body.title || '').trim().slice(0, 200);
      const text = String(body.body || '').trim().slice(0, 10000);
      if (!title) return json({ error: 'A section title is required' }, 400, cors);
      const result = await env.DB.prepare(`UPDATE content SET title=?, body=?, enabled=?, published=?, updated_at=CURRENT_TIMESTAMP WHERE section=?`)
        .bind(title, text, body.enabled === true ? 1 : 0, body.published === true ? 1 : 0, section).run();
      if (!result.meta.changes) return json({ error: 'Content section not found' }, 404, cors);
      await logEvent(env, 'Content updated', section, 'content');
      const row = await env.DB.prepare('SELECT * FROM content WHERE section=?').bind(section).first();
      return json(row, 200, cors);
    }

    if (request.method === 'PATCH' && /^\/api\/admin\/messages\/\d+$/.test(pathname)) {
      const id = Number(pathname.split('/').pop());
      const body = await request.json();
      const allowedStatuses = new Set(['new', 'read', 'replied', 'archived']);
      if (!allowedStatuses.has(body.status)) return json({ error: 'Invalid message status' }, 400, cors);
      const result = await env.DB.prepare('UPDATE messages SET status=? WHERE id=?').bind(body.status, id).run();
      if (!result.meta.changes) return json({ error: 'Message not found' }, 404, cors);
      await logEvent(env, 'Message status updated', String(id), 'messages');
      return json({ ok: true }, 200, cors);
    }

    if (pathname === '/api/admin/logout' && request.method === 'POST') {
      await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash=?').bind(await digest(request.headers.get('Authorization').slice(7))).run();
      await logEvent(env, 'Admin logged out', session.email, 'admin');
      return json({ ok: true }, 200, cors);
    }
    return json({ error: 'Admin endpoint not found' }, 404, cors);
  }
  return json({ error: 'Not found' }, 404, cors);
}

export default {
  async fetch(request, env) {
    try {
      return await route(request, env);
    } catch (error) {
      console.error(error);
      return json({ error: 'Internal server error' }, 500, corsHeaders(request, env));
    }
  }
};
