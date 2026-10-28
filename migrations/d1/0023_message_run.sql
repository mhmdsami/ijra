ALTER TABLE messages ADD COLUMN run_id TEXT;

CREATE INDEX IF NOT EXISTS messages_run_idx ON messages (run_id);
