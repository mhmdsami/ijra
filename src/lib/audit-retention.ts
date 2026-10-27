export const AUDIT_RETENTION_DAYS = 365;

export const PURGE_AUDIT_SQL = "DELETE FROM audit_events WHERE created_at < ?";

/** Cutoff for retention: events created before this are removed. */
export function auditCutoff(now = Date.now(), days = AUDIT_RETENTION_DAYS) {
  return now - days * 24 * 60 * 60_000;
}
