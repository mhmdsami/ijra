export const SESSIONS_PER_DAY = 20;

export interface SessionInsertInput {
  id: string;
  project: string;
  ownerId: string;
  createdAt: number;
  dayStart: number;
  limit?: number;
}

export function sessionInsertStatement(input: SessionInsertInput) {
  return {
    sql: `INSERT INTO sessions (id, project, owner_id, created_at)
     SELECT ?, ?, ?, ?
     WHERE (
       SELECT COUNT(*) FROM sessions WHERE owner_id = ? AND created_at >= ?
     ) < ?`,
    binds: [
      input.id,
      input.project,
      input.ownerId,
      input.createdAt,
      input.ownerId,
      input.dayStart,
      input.limit ?? SESSIONS_PER_DAY,
    ],
  };
}
