CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  project TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  role TEXT NOT NULL CHECK (role IN ('user', 'agent')),
  content TEXT NOT NULL,
  meta TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX messages_session_idx ON messages (session_id, created_at);

CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  project TEXT NOT NULL,
  request TEXT NOT NULL,
  model TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'dispatching',
  gh_run_id INTEGER,
  gh_run_url TEXT,
  pr_url TEXT,
  branch TEXT,
  safe_zone INTEGER,
  agent_msg INTEGER NOT NULL DEFAULT 0,
  dispatch_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX runs_session_idx ON runs (session_id, dispatch_at);
