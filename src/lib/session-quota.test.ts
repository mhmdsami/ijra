import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { SESSIONS_PER_DAY, sessionInsertStatement } from "./session-quota.ts";

function openDatabase() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      project TEXT NOT NULL,
      owner_id TEXT,
      created_at INTEGER NOT NULL
    );
  `);
  return db;
}

let sequence = 0;
function create(
  db: DatabaseSync,
  input: { ownerId?: string; createdAt?: number; dayStart?: number; limit?: number } = {},
) {
  sequence += 1;
  const { sql, binds } = sessionInsertStatement({
    id: `session-${sequence}`,
    project: "ijra",
    ownerId: input.ownerId ?? "user-1",
    createdAt: input.createdAt ?? 1_000,
    dayStart: input.dayStart ?? 0,
    limit: input.limit,
  });
  return Number(db.prepare(sql).run(...binds).changes) === 1;
}

test("allows threads up to the daily limit and refuses the next one", () => {
  const db = openDatabase();
  for (let n = 0; n < SESSIONS_PER_DAY; n += 1) assert.equal(create(db), true, `session ${n + 1}`);
  assert.equal(create(db), false);
});

test("counts per owner", () => {
  const db = openDatabase();
  for (let n = 0; n < SESSIONS_PER_DAY; n += 1) create(db, { ownerId: "user-1" });
  assert.equal(create(db, { ownerId: "user-2" }), true);
});

test("ignores threads created before the UTC day start", () => {
  const db = openDatabase();
  for (let n = 0; n < SESSIONS_PER_DAY; n += 1) create(db, { createdAt: 100, dayStart: 0 });
  assert.equal(create(db, { createdAt: 1_000, dayStart: 900 }), true);
});

test("respects a custom limit", () => {
  const db = openDatabase();
  assert.equal(create(db, { limit: 1 }), true);
  assert.equal(create(db, { limit: 1 }), false);
});
