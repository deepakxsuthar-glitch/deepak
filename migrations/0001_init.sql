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
  session_id TEXT NOT NULL UNIQUE,
  page TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  last_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  csrf_hash TEXT NOT NULL,
  email TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO content (section, title, body) VALUES
  ('hero', 'Hi! I am Deepak', 'BCA student and self-taught developer building with AI, web, automation and creative technology.'),
  ('about', 'Who is Deepak?', 'A BCA student and self-taught developer from Rajasthan, India.'),
  ('services', 'Things I enjoy working on', 'AI assistants, web experiences, automation, UI/UX, programming and digital systems.'),
  ('skills', 'Skills I am building', 'HTML / CSS, JavaScript, Python, Git / GitHub, AI Tools & APIs, and UI / UX.'),
  ('education', 'Learning Journey', 'Bachelor of Computer Applications (BCA), currently in progress.'),
  ('experience', 'What I am working toward', 'Full-stack development, AI and agent systems, and portfolio UI systems.'),
  ('projects', 'Things I have been building', 'ASTRAX, JARVIS v2, Deepak Digital Identity, Agent Automation, Full-stack Practice, and Interface Experiments.'),
  ('notes', 'What I am learning', 'Building useful AI agents, learning full-stack by building, and designing interfaces with personality.'),
  ('contact', 'Let us connect', 'Open to learning, collaboration, freelance experiments, and entry-level opportunities.');
