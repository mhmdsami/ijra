CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT OR IGNORE INTO settings (key, value) VALUES (
  'models',
  '[{"id":"deepseek-flash","label":"DeepSeek V4.1 Flash","vision":true,"default":true},{"id":"muse-spark-1.3-contributor","label":"Muse Spark 1.3 Contributor","vision":true,"default":false},{"id":"deepseek-v4-flash","label":"DeepSeek V4 Flash","vision":false,"default":false}]'
);
DROP TABLE IF EXISTS models;
