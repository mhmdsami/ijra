CREATE TABLE IF NOT EXISTS user_limits (
  user_id TEXT NOT NULL,
  model TEXT NOT NULL,
  daily_limit INTEGER NOT NULL,
  PRIMARY KEY (user_id, model)
);
