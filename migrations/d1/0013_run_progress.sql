CREATE TABLE IF NOT EXISTS run_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  kind TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS run_progress_run_seq_idx ON run_progress (run_id, seq);
CREATE INDEX IF NOT EXISTS run_progress_run_id_idx ON run_progress (run_id, id);
