import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { PRUNE_CALLBACKS_SQL, RECORD_CALLBACK_SQL, REPLAY_TTL_MS } from "./replay.ts";

function openDatabase() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE runner_callbacks (
      fingerprint TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      received_at INTEGER NOT NULL
    );
    CREATE INDEX runner_callbacks_received_idx ON runner_callbacks (received_at);
  `);
  return db;
}

function record(db: DatabaseSync, fingerprint: string, runId: string, receivedAt: number) {
  return Number(db.prepare(RECORD_CALLBACK_SQL).run(fingerprint, runId, receivedAt).changes) === 1;
}

function count(db: DatabaseSync) {
  return Number((db.prepare("SELECT COUNT(*) AS n FROM runner_callbacks").get() as { n: number }).n);
}

test("records a callback fingerprint once", () => {
  const db = openDatabase();
  assert.equal(record(db, "abc", "run-1", 1_000), true);
  assert.equal(count(db), 1);
});

test("ignores a replayed fingerprint even for another run id", () => {
  const db = openDatabase();
  assert.equal(record(db, "abc", "run-1", 1_000), true);
  assert.equal(record(db, "abc", "run-1", 1_000), false);
  assert.equal(record(db, "abc", "run-2", 1_000), false);
  assert.equal(count(db), 1);
});

test("different fingerprints are both recorded", () => {
  const db = openDatabase();
  assert.equal(record(db, "abc", "run-1", 1_000), true);
  assert.equal(record(db, "def", "run-1", 1_000), true);
  assert.equal(count(db), 2);
});

test("prunes callbacks older than the retention window", () => {
  const db = openDatabase();
  const now = 10 * REPLAY_TTL_MS;
  record(db, "old", "run-1", now - REPLAY_TTL_MS - 1);
  record(db, "fresh", "run-2", now - 1_000);
  const pruned = Number(db.prepare(PRUNE_CALLBACKS_SQL).run(now - REPLAY_TTL_MS).changes);
  assert.equal(pruned, 1);
  assert.equal(count(db), 1);
});
