CREATE TABLE runner_callbacks (
  fingerprint TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  received_at INTEGER NOT NULL
);
CREATE INDEX runner_callbacks_received_idx ON runner_callbacks (received_at);
