CREATE TABLE IF NOT EXISTS models (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  vision INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO models (id, label, vision, is_default, sort) VALUES
  ('deepseek-flash', 'DeepSeek V4.1 Flash', 1, 1, 0),
  ('muse-spark-1.3-contributor', 'Muse Spark 1.3 Contributor', 1, 0, 1),
  ('deepseek-v4-flash', 'DeepSeek V4 Flash', 0, 0, 2);
