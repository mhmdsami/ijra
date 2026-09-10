import { env, now } from "./env";

export const DEFAULT_DAILY_LIMIT = 5;

export interface SessionRow {
  id: string;
  project: string;
  title: string;
  owner_id: string | null;
  created_at: number;
}

export interface MessageRow {
  id: number;
  session_id: string;
  role: "user" | "agent";
  content: string;
  meta: string | null;
  created_at: number;
}

export interface RunRow {
  id: string;
  session_id: string;
  project: string;
  request: string;
  model: string;
  mode: "fix" | "ask" | "auto";
  status: string;
  gh_run_id: number | null;
  gh_run_url: string | null;
  pr_url: string | null;
  branch: string | null;
  safe_zone: number | null;
  agent_msg: number;
  dispatch_at: number;
  updated_at: number;
  requested_by: string | null;
  policy_status: string;
  policy_reasons: string | null;
  decision: string | null;
  decided_by: string | null;
  decided_at: number | null;
  decision_reason: string | null;
}

export interface ModelRow {
  id: string;
  label: string;
  vision: number;
  is_default: number;
}

async function readModels(): Promise<ModelRow[]> {
  const row = await env().DB.prepare("SELECT value FROM settings WHERE key = 'models'").first<{ value: string }>();
  if (!row) return [];
  const parsed = JSON.parse(row.value) as { id: string; label: string; vision?: boolean; default?: boolean }[];
  return parsed.map((m) => ({ id: m.id, label: m.label, vision: m.vision ? 1 : 0, is_default: m.default ? 1 : 0 }));
}

async function writeModels(models: ModelRow[]) {
  const value = JSON.stringify(models.map((m) => ({ id: m.id, label: m.label, vision: m.vision === 1, default: m.is_default === 1 })));
  await env().DB.prepare("INSERT INTO settings (key, value) VALUES ('models', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").bind(value).run();
}

export async function listModels() {
  return readModels();
}

export async function getModel(id: string) {
  return (await readModels()).find((m) => m.id === id) ?? null;
}

export async function getDefaultModel() {
  const models = await readModels();
  return (models.find((m) => m.is_default === 1) ?? models[0])?.id ?? null;
}

export async function addModel(id: string, label: string, vision: boolean) {
  const models = await readModels();
  if (models.some((m) => m.id === id)) return;
  await writeModels([...models, { id, label, vision: vision ? 1 : 0, is_default: models.length === 0 ? 1 : 0 }]);
}

export async function removeModel(id: string) {
  const models = await readModels();
  const wasDefault = models.find((m) => m.id === id)?.is_default === 1;
  const next = models.filter((m) => m.id !== id);
  if (wasDefault && next.length > 0) next[0] = { ...next[0], is_default: 1 };
  await writeModels(next);
}

export async function setDefaultModel(id: string) {
  const models = await readModels();
  await writeModels(models.map((m) => ({ ...m, is_default: m.id === id ? 1 : 0 })));
}

export interface AuditEventRow {
  id: number;
  run_id: string | null;
  session_id: string;
  actor_id: string | null;
  action: string;
  metadata: string | null;
  created_at: number;
}

export async function countUsers() {
  const row = await env().DB.prepare("SELECT COUNT(*) AS n FROM user").first<{ n: number }>();
  return row?.n ?? 0;
}

export async function adminCount() {
  const row = await env().DB.prepare("SELECT COUNT(*) AS n FROM user WHERE role = 'admin'").first<{ n: number }>();
  return row?.n ?? 0;
}

export async function promoteToAdmin(userId: string) {
  await env().DB.prepare("UPDATE user SET role = 'admin' WHERE id = ?").bind(userId).run();
}

export async function listUsers() {
  const { results } = await env()
    .DB.prepare("SELECT id, email, name, role, createdAt FROM user ORDER BY createdAt")
    .all<{ id: string; email: string; name: string; role: string | null; createdAt: number }>();
  return results ?? [];
}

export async function getSuperAdminId() {
  const row = await env()
    .DB.prepare("SELECT id FROM user WHERE role = 'admin' ORDER BY createdAt ASC, rowid ASC LIMIT 1")
    .first<{ id: string }>();
  return row?.id ?? null;
}

export async function deleteUserRow(id: string) {
  await env().DB.prepare("DELETE FROM user WHERE id = ?").bind(id).run();
}

export async function setUserProject(userId: string, project: string, canWrite: boolean) {
  await env()
    .DB.prepare(
      "INSERT INTO user_projects (userId, project, can_write) VALUES (?, ?, ?) ON CONFLICT (userId, project) DO UPDATE SET can_write = excluded.can_write"
    )
    .bind(userId, project, canWrite ? 1 : 0)
    .run();
}

export async function removeUserProject(userId: string, project: string) {
  await env().DB.prepare("DELETE FROM user_projects WHERE userId = ? AND project = ?").bind(userId, project).run();
}

export async function getUserProjects(userId: string) {
  const { results } = await env()
    .DB.prepare("SELECT project, can_write FROM user_projects WHERE userId = ?")
    .bind(userId)
    .all<{ project: string; can_write: number }>();
  return results.map((r) => ({ project: r.project, canWrite: r.can_write === 1 }));
}

const listSessionsBase = `
  SELECT s.*, (SELECT r.status FROM runs r WHERE r.session_id = s.id ORDER BY r.dispatch_at DESC, r.rowid DESC LIMIT 1) AS last_status,
    (SELECT email FROM user WHERE id = s.owner_id) AS owner_email
  FROM sessions s`;
const getMessagesStmt = "SELECT * FROM messages WHERE session_id = ? ORDER BY created_at, id";
const getRunsStmt = "SELECT * FROM runs WHERE session_id = ? ORDER BY dispatch_at, rowid";

export interface SessionRowWithStatus extends SessionRow {
  last_status: string | null;
  owner_email: string | null;
}

export async function listSessionsForUser(userId: string, allowedProjects: string[] | null) {
  if (allowedProjects && allowedProjects.length === 0) return [];
  const stmt =
    allowedProjects === null
      ? `${listSessionsBase} ORDER BY s.created_at DESC`
      : `${listSessionsBase} WHERE s.owner_id = ? AND s.project IN (${allowedProjects.map(() => "?").join(", ")}) ORDER BY s.created_at DESC`;
  const { results } = await (allowedProjects === null
    ? env().DB.prepare(stmt)
    : env().DB.prepare(stmt).bind(userId, ...allowedProjects)
  ).all<SessionRowWithStatus>();
  return results ?? [];
}

export async function getOwnerEmail(userId: string) {
  const row = await env().DB.prepare("SELECT email FROM user WHERE id = ?").bind(userId).first<{ email: string }>();
  return row?.email ?? null;
}

export async function getSession(id: string) {
  return env().DB.prepare("SELECT * FROM sessions WHERE id = ?").bind(id).first<SessionRow>();
}

export async function createSession(project: string, ownerId: string) {
  const id = crypto.randomUUID();
  await env().DB.prepare("INSERT INTO sessions (id, project, owner_id, created_at) VALUES (?, ?, ?, ?)")
    .bind(id, project, ownerId, now())
    .run();
  return id;
}

export async function addMessage(sessionId: string, role: "user" | "agent", content: string, meta?: object) {
  await env().DB.prepare("INSERT INTO messages (session_id, role, content, meta, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(sessionId, role, content, meta ? JSON.stringify(meta) : null, now())
    .run();
}

export async function getMessages(sessionId: string) {
  const { results } = await env().DB.prepare(getMessagesStmt).bind(sessionId).all<MessageRow>();
  return results ?? [];
}

const secretKey = /token|secret|password|authorization|cookie|api[_-]?key|private[_-]?key/i;

function redactAuditMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactAuditMetadata);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, secretKey.test(key) ? "[redacted]" : redactAuditMetadata(child)])
  );
}

export async function appendAuditEvent(input: {
  sessionId: string;
  action: string;
  actorId?: string | null;
  runId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const metadata = input.metadata ? JSON.stringify(redactAuditMetadata(input.metadata)) : null;
  await env().DB.prepare(
    "INSERT INTO audit_events (run_id, session_id, actor_id, action, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(input.runId ?? null, input.sessionId, input.actorId ?? null, input.action, metadata, now())
    .run();
}

export async function countRunsForUserSince(userId: string, since: number) {
  const row = await env()
    .DB.prepare("SELECT COUNT(*) AS n FROM runs WHERE requested_by = ? AND dispatch_at >= ?")
    .bind(userId, since)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function getUserLimit(userId: string) {
  const row = await env().DB.prepare("SELECT daily_limit FROM user_limits WHERE user_id = ?").bind(userId).first<{ daily_limit: number }>();
  return row?.daily_limit ?? null;
}

export async function setUserLimit(userId: string, dailyLimit: number) {
  await env()
    .DB.prepare("INSERT INTO user_limits (user_id, daily_limit) VALUES (?, ?) ON CONFLICT (user_id) DO UPDATE SET daily_limit = excluded.daily_limit")
    .bind(userId, dailyLimit)
    .run();
}

export async function removeUserLimit(userId: string) {
  await env().DB.prepare("DELETE FROM user_limits WHERE user_id = ?").bind(userId).run();
}

const activeRunStatuses = ["dispatching", "running"];

export async function countActiveRunsForProject(project: string) {
  const row = await env().DB.prepare(
    `SELECT COUNT(*) AS n FROM runs WHERE project = ? AND status IN (${activeRunStatuses.map(() => "?").join(", ")})`
  )
    .bind(project, ...activeRunStatuses)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function createRun(
  sessionId: string,
  project: string,
  request: string,
  model: string,
  requestedBy: string,
  requestWindowStart: number,
  mode: "fix" | "ask" | "auto" = "auto"
) {
  const id = crypto.randomUUID();
  const t = now();
  const result = await env().DB.prepare(
    `INSERT INTO runs (id, session_id, project, request, model, requested_by, mode, status, dispatch_at, updated_at)
     SELECT ?, ?, ?, ?, ?, ?, ?, 'dispatching', ?, ?
     WHERE NOT EXISTS (
       SELECT 1 FROM runs WHERE project = ? AND status IN (${activeRunStatuses.map(() => "?").join(", ")})
     )
     AND (SELECT COUNT(*) FROM runs WHERE requested_by = ? AND dispatch_at >= ?) < 5`
  )
    .bind(id, sessionId, project, request, model, requestedBy, mode, t, t, project, ...activeRunStatuses, requestedBy, requestWindowStart)
    .run();
  return result.meta.changes === 1 ? id : null;
}

export async function deleteSession(sessionId: string) {
  const db = env().DB;
  await db.batch([
    db.prepare("DELETE FROM runs WHERE session_id = ?").bind(sessionId),
    db.prepare("DELETE FROM messages WHERE session_id = ?").bind(sessionId),
    db.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId),
  ]);
}

export async function updateRun(id: string, fields: Partial<RunRow>) {
  const allowed = ["status", "gh_run_id", "gh_run_url", "pr_url", "branch", "safe_zone", "agent_msg", "policy_status", "policy_reasons"] as const;
  const sets = allowed.filter((k) => k in fields);
  if (sets.length === 0) return;
  const sql = `UPDATE runs SET ${sets.map((k) => `${k} = ?`).join(", ")}, updated_at = ? WHERE id = ?`;
  await env().DB.prepare(sql)
    .bind(...sets.map((k) => fields[k] ?? null), now(), id)
    .run();
}

const allowedRunTransitions: Record<string, readonly string[]> = {
  dispatching: ["running", "done", "failed", "cancelled"],
  running: ["done", "merged", "failed", "cancelled"],
  done: ["merged"],
};

export async function transitionRun(input: {
  id: string;
  status: string;
  actorId?: string | null;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  const run = await getRun(input.id);
  if (!run || !allowedRunTransitions[run.status]?.includes(input.status)) return false;

  const t = now();
  const metadata = input.metadata ? JSON.stringify(redactAuditMetadata(input.metadata)) : null;
  const db = env().DB;
  await db.batch([
    db.prepare("UPDATE runs SET status = ?, updated_at = ? WHERE id = ? AND status = ?")
      .bind(input.status, t, input.id, run.status),
    db.prepare("INSERT INTO audit_events (run_id, session_id, actor_id, action, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(input.id, run.session_id, input.actorId ?? null, input.action, metadata, t),
  ]);
  return true;
}

export async function recordRunDecision(input: {
  id: string;
  decision: "approved" | "rejected";
  actorId: string;
  reason?: string;
}) {
  const run = await getRun(input.id);
  if (!run || run.decision) return false;

  const t = now();
  const db = env().DB;
  await db.batch([
    db.prepare("UPDATE runs SET decision = ?, decided_by = ?, decided_at = ?, decision_reason = ?, updated_at = ? WHERE id = ? AND decision IS NULL")
      .bind(input.decision, input.actorId, t, input.reason ?? null, t, input.id),
    db.prepare("INSERT INTO audit_events (run_id, session_id, actor_id, action, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(input.id, run.session_id, input.actorId, `run.${input.decision}`, JSON.stringify({ reason: input.reason ?? null }), t),
  ]);
  return true;
}

export async function getRun(id: string) {
  return env().DB.prepare("SELECT * FROM runs WHERE id = ?").bind(id).first<RunRow>();
}

export async function getRuns(sessionId: string) {
  const { results } = await env().DB.prepare(getRunsStmt).bind(sessionId).all<RunRow>();
  return results ?? [];
}

export async function touchSessionTitle(sessionId: string, title: string) {
  await env().DB.prepare("UPDATE sessions SET title = ? WHERE id = ? AND title = ''").bind(title, sessionId).run();
}
