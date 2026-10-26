export const REPLAY_TTL_MS = 24 * 60 * 60_000;

export const RECORD_CALLBACK_SQL =
  "INSERT OR IGNORE INTO runner_callbacks (fingerprint, run_id, received_at) VALUES (?, ?, ?)";

export const PRUNE_CALLBACKS_SQL = "DELETE FROM runner_callbacks WHERE received_at < ?";
