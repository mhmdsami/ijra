export const ACTIVE_RUN_STATUSES = ["dispatching", "running"] as const;

export const QUOTA_EXEMPT_STATUSES = ["failed", "blocked", "cancelled"] as const;

export interface AdmissionInput {
  id: string;
  sessionId: string;
  project: string;
  request: string;
  model: string;
  requestedBy: string;
  requestWindowStart: number;
  dailyLimit: number | null;
  mode: "fix" | "ask" | "auto";
  dispatchAt: number;
}

export function admissionStatement(input: AdmissionInput) {
  const exempt = QUOTA_EXEMPT_STATUSES.map(() => "?").join(", ");
  const limitClause =
    input.dailyLimit === null
      ? ""
      : ` AND (SELECT COUNT(*) FROM runs WHERE requested_by = ? AND dispatch_at >= ? AND status NOT IN (${exempt})) < ?`;
  const limitBinds =
    input.dailyLimit === null
      ? []
      : [input.requestedBy, input.requestWindowStart, ...QUOTA_EXEMPT_STATUSES, input.dailyLimit];
  const activePlaceholders = ACTIVE_RUN_STATUSES.map(() => "?").join(", ");

  return {
    sql: `INSERT INTO runs (id, session_id, project, request, model, requested_by, mode, status, dispatch_at, updated_at)
     SELECT ?, ?, ?, ?, ?, ?, ?, 'dispatching', ?, ?
     WHERE NOT EXISTS (
       SELECT 1 FROM runs WHERE project = ? AND status IN (${activePlaceholders})
     )${limitClause}`,
    binds: [
      input.id,
      input.sessionId,
      input.project,
      input.request,
      input.model,
      input.requestedBy,
      input.mode,
      input.dispatchAt,
      input.dispatchAt,
      input.project,
      ...ACTIVE_RUN_STATUSES,
      ...limitBinds,
    ],
  };
}
