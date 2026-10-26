ALTER TABLE runs ADD COLUMN parent_run_id TEXT;

CREATE INDEX runs_parent_run_idx ON runs (parent_run_id);
