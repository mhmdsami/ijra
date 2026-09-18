CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  run_id TEXT,
  mime TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  bytes BLOB NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS images_session_created_idx ON images (session_id, created_at);
