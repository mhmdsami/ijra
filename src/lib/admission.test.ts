import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { admissionStatement, type AdmissionInput } from "./admission.ts";

function openDatabase() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE runs (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      project TEXT NOT NULL,
      request TEXT NOT NULL,
      model TEXT NOT NULL,
      requested_by TEXT,
      mode TEXT NOT NULL,
      status TEXT NOT NULL,
      dispatch_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  return db;
}

let sequence = 0;
const base: AdmissionInput = {
  id: "run-1",
  sessionId: "session-1",
  project: "ijra",
  request: "test request",
  model: "model",
  requestedBy: "user-1",
  requestWindowStart: 0,
  dailyLimit: null,
  mode: "auto",
  dispatchAt: 1_000,
};

function admit(db: DatabaseSync, overrides: Partial<AdmissionInput> = {}) {
  sequence += 1;
  const input = { ...base, id: `run-${sequence}`, ...overrides };
  const { sql, binds } = admissionStatement(input);
  const result = db.prepare(sql).run(...binds);
  return { admitted: Number(result.changes) === 1, id: input.id };
}

function seed(db: DatabaseSync, rows: { id: string; project?: string; user?: string; status?: string; dispatchAt?: number }[]) {
  const insert = db.prepare(
    "INSERT INTO runs (id, session_id, project, request, model, requested_by, mode, status, dispatch_at, updated_at) VALUES (?, 's', ?, 'r', 'm', ?, 'auto', ?, ?, ?)"
  );
  for (const row of rows) {
    insert.run(row.id, row.project ?? "ijra", row.user ?? "user-1", row.status ?? "done", row.dispatchAt ?? 500, row.dispatchAt ?? 500);
  }
}

test("admits the first run in a project", () => {
  const db = openDatabase();
  assert.equal(admit(db).admitted, true);
});

test("refuses a second active run in the same project", () => {
  const db = openDatabase();
  assert.equal(admit(db).admitted, true);
  assert.equal(admit(db).admitted, false);
  assert.equal(admit(db, { project: "other" }).admitted, true);
});

test("only dispatching and running runs hold the project slot", () => {
  const db = openDatabase();
  seed(db, [
    { id: "review", status: "awaiting_review" },
    { id: "merged", status: "merged" },
    { id: "failed", status: "failed" },
  ]);
  assert.equal(admit(db).admitted, true);
});

test("enforces the configured daily limit against runs in the window", () => {
  const db = openDatabase();
  seed(db, [1, 2, 3, 4, 5].map((n) => ({ id: `history-${n}`, user: "user-1", dispatchAt: 500 })));
  assert.equal(admit(db, { dailyLimit: 5 }).admitted, false);
  assert.equal(admit(db, { dailyLimit: 6 }).admitted, true);
});

test("does not count runs before the window", () => {
  const db = openDatabase();
  seed(db, [{ id: "old", dispatchAt: 100 }]);
  assert.equal(admit(db, { requestWindowStart: 500, dailyLimit: 1 }).admitted, true);
});

test("counts only the requesting user", () => {
  const db = openDatabase();
  seed(db, [1, 2, 3, 4, 5].map((n) => ({ id: `other-${n}`, user: "user-2", dispatchAt: 500 })));
  assert.equal(admit(db, { dailyLimit: 5 }).admitted, true);
});

test("a null limit skips the quota check", () => {
  const db = openDatabase();
  seed(db, Array.from({ length: 10 }, (_, n) => ({ id: `history-${n}`, dispatchAt: 500 })));
  assert.equal(admit(db, { dailyLimit: null }).admitted, true);
});

test("concurrent attempts cannot both take the project slot", () => {
  const db = openDatabase();
  const first = admit(db);
  const second = admit(db);
  assert.equal(first.admitted, true);
  assert.equal(second.admitted, false);
  const count = db.prepare("SELECT COUNT(*) AS n FROM runs").get() as { n: number };
  assert.equal(Number(count.n), 1);
});
