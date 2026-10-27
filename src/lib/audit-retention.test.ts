import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { AUDIT_RETENTION_DAYS, auditCutoff, PURGE_AUDIT_SQL } from "./audit-retention.ts";

test("the cutoff is one year before now", () => {
  const now = 1_760_000_000_000;
  assert.equal(auditCutoff(now), now - AUDIT_RETENTION_DAYS * 24 * 60 * 60_000);
  assert.equal(AUDIT_RETENTION_DAYS, 365);
});

test("purges events older than the cutoff and keeps newer ones", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE audit_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TRIGGER audit_events_no_update
    BEFORE UPDATE ON audit_events
    BEGIN
      SELECT RAISE(ABORT, 'audit_events are append-only');
    END;
  `);
  const insert = db.prepare("INSERT INTO audit_events (action, created_at) VALUES (?, ?)");
  const cutoff = 1_000_000;
  insert.run("old", cutoff - 1);
  insert.run("boundary", cutoff);
  insert.run("new", cutoff + 1);

  const removed = Number(db.prepare(PURGE_AUDIT_SQL).run(cutoff).changes);
  assert.equal(removed, 1);
  const rows = db.prepare("SELECT action FROM audit_events ORDER BY created_at").all() as { action: string }[];
  assert.deepEqual(
    rows.map((row) => row.action),
    ["boundary", "new"],
  );
});

test("the no-update trigger still protects retained events", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE audit_events (id INTEGER PRIMARY KEY, action TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TRIGGER audit_events_no_update
    BEFORE UPDATE ON audit_events
    BEGIN
      SELECT RAISE(ABORT, 'audit_events are append-only');
    END;
  `);
  db.prepare("INSERT INTO audit_events (action, created_at) VALUES ('x', 1)").run();
  assert.throws(() => db.prepare("UPDATE audit_events SET action = 'y' WHERE id = 1").run());
});
