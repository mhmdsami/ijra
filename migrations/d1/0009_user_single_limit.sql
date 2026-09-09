DROP TABLE IF EXISTS user_limits;
CREATE TABLE user_limits (
  user_id TEXT PRIMARY KEY,
  daily_limit INTEGER NOT NULL
);
