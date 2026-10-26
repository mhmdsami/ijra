export const ACTIVE_RUN_STATUSES = ["dispatching", "running"] as const;

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

/**
 * The insertion that admits a run. It enforces one active run per project and the
 * per-user daily limit in the same statement, so concurrent requests cannot both
 * pass preflight checks and then both insert.
 */
export function admissionStatement(input: AdmissionInput) {
  const limitClause =
    input.dailyLimit === null ? "" : " AND (SELECT COUNT(*) FROM runs WHERE requested_by = ? AND dispatch_at >= ?) < ?";
  const limitBinds = input.dailyLimit === null ? [] : [input.requestedBy, input.requestWindowStart, input.dailyLimit];
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
