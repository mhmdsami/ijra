import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { imageInsertStatement } from "./image-storage.ts";
import { MAX_IMAGES_PER_SESSION, MAX_IMAGES_PER_USER_PER_DAY } from "./images.ts";

function openDatabase() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      owner_id TEXT
    );
    CREATE TABLE images (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      mime TEXT NOT NULL,
      width INTEGER,
      height INTEGER,
      bytes BLOB NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX images_session_created_idx ON images (session_id, created_at);
  `);
  return db;
}

function addSession(db: DatabaseSync, id: string, ownerId: string) {
  db.prepare("INSERT INTO sessions (id, owner_id) VALUES (?, ?)").run(id, ownerId);
}

let sequence = 0;
function upload(
  db: DatabaseSync,
  input: { sessionId: string; ownerId: string; createdAt?: number; dayStart?: number }
) {
  sequence += 1;
  const { sql, binds } = imageInsertStatement({
    id: `image-${sequence}`,
    sessionId: input.sessionId,
    ownerId: input.ownerId,
    mime: "image/png",
    width: 10,
    height: 10,
    bytes: new Uint8Array([1, 2, 3]),
    createdAt: input.createdAt ?? 1_000,
    dayStart: input.dayStart ?? 0,
  });
  return Number(db.prepare(sql).run(...binds).changes) === 1;
}

test("allows images up to the per-session cap and refuses the next one", () => {
  const db = openDatabase();
  addSession(db, "s1", "u1");
  for (let n = 0; n < MAX_IMAGES_PER_SESSION; n += 1) {
    assert.equal(upload(db, { sessionId: "s1", ownerId: "u1" }), true, `image ${n + 1}`);
  }
  assert.equal(upload(db, { sessionId: "s1", ownerId: "u1" }), false);
});

test("a second session for the same owner still counts toward the daily cap", () => {
  const db = openDatabase();
  addSession(db, "s1", "u1");
  addSession(db, "s2", "u1");
  for (let n = 0; n < MAX_IMAGES_PER_SESSION; n += 1) upload(db, { sessionId: "s1", ownerId: "u1" });
  for (let n = 0; n < MAX_IMAGES_PER_USER_PER_DAY - MAX_IMAGES_PER_SESSION; n += 1) {
    assert.equal(upload(db, { sessionId: "s2", ownerId: "u1" }), true, `image ${MAX_IMAGES_PER_SESSION + n + 1}`);
  }
  addSession(db, "s3", "u1");
  assert.equal(upload(db, { sessionId: "s3", ownerId: "u1" }), false);
});

test("another owner's images do not consume the daily cap", () => {
  const db = openDatabase();
  addSession(db, "s1", "u1");
  addSession(db, "s2", "u2");
  for (let n = 0; n < MAX_IMAGES_PER_SESSION; n += 1) upload(db, { sessionId: "s1", ownerId: "u1" });
  assert.equal(upload(db, { sessionId: "s2", ownerId: "u2" }), true);
});

test("images from before the current day do not count", () => {
  const db = openDatabase();
  addSession(db, "s1", "u1");
  addSession(db, "s2", "u1");
  addSession(db, "s3", "u1");
  for (let n = 0; n < MAX_IMAGES_PER_SESSION; n += 1) upload(db, { sessionId: "s1", ownerId: "u1", createdAt: 500, dayStart: 0 });
  for (let n = 0; n < MAX_IMAGES_PER_USER_PER_DAY - MAX_IMAGES_PER_SESSION; n += 1) {
    upload(db, { sessionId: "s2", ownerId: "u1", createdAt: 500, dayStart: 0 });
  }
  assert.equal(upload(db, { sessionId: "s3", ownerId: "u1", createdAt: 1_000, dayStart: 900 }), true);
});

test("pending uploads in the same session cannot exceed the session cap at once", () => {
  const db = openDatabase();
  addSession(db, "s1", "u1");
  for (let n = 0; n < MAX_IMAGES_PER_SESSION; n += 1) upload(db, { sessionId: "s1", ownerId: "u1" });
  assert.equal(upload(db, { sessionId: "s1", ownerId: "u1" }), false);
  const count = db.prepare("SELECT COUNT(*) AS n FROM images WHERE session_id = 's1'").get() as { n: number };
  assert.equal(Number(count.n), MAX_IMAGES_PER_SESSION);
});
