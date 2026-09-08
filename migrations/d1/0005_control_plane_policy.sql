ALTER TABLE sessions ADD COLUMN owner_id TEXT REFERENCES user(id);

CREATE INDEX sessions_owner_created_idx ON sessions (owner_id, created_at DESC);

ALTER TABLE runs ADD COLUMN requested_by TEXT REFERENCES user(id);
ALTER TABLE runs ADD COLUMN policy_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE runs ADD COLUMN policy_reasons TEXT;
ALTER TABLE runs ADD COLUMN decision TEXT;
ALTER TABLE runs ADD COLUMN decided_by TEXT REFERENCES user(id);
ALTER TABLE runs ADD COLUMN decided_at INTEGER;
ALTER TABLE runs ADD COLUMN decision_reason TEXT;

CREATE INDEX runs_requested_by_dispatch_idx ON runs (requested_by, dispatch_at);
CREATE INDEX runs_project_status_idx ON runs (project, status);

CREATE TABLE audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT,
  session_id TEXT NOT NULL,
  actor_id TEXT,
  action TEXT NOT NULL,
  metadata TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX audit_events_run_created_idx ON audit_events (run_id, created_at, id);
CREATE INDEX audit_events_session_created_idx ON audit_events (session_id, created_at, id);

CREATE TRIGGER audit_events_no_update
BEFORE UPDATE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit_events are append-only');
END;

CREATE TRIGGER audit_events_no_delete
BEFORE DELETE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit_events are append-only');
END;
