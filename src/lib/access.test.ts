import { test } from "node:test";
import assert from "node:assert/strict";
import { canAccessSession, canReviewRun, canWriteProject } from "./access.ts";

const admin = { id: "admin", isAdmin: true, allowedProjects: null, writeProjects: null };
const owner = { id: "owner", isAdmin: false, allowedProjects: ["ijra"], writeProjects: ["ijra"] };
const stranger = { id: "stranger", isAdmin: false, allowedProjects: ["ijra"], writeProjects: ["ijra"] };
const revoked = { id: "owner", isAdmin: false, allowedProjects: [], writeProjects: [] };

test("admins reach every session regardless of ownership", () => {
  assert.equal(canAccessSession(admin, { owner_id: "someone", project: "ijra" }), true);
  assert.equal(canAccessSession(admin, { owner_id: null, project: "unknown" }), true);
});

test("an owner with a grant reaches their own session", () => {
  assert.equal(canAccessSession(owner, { owner_id: "owner", project: "ijra" }), true);
});

test("a granted user cannot read another user's session", () => {
  assert.equal(canAccessSession(stranger, { owner_id: "owner", project: "ijra" }), false);
});

test("an owner loses access when the project grant is revoked", () => {
  assert.equal(canAccessSession(revoked, { owner_id: "owner", project: "ijra" }), false);
});

test("an owner whose grant is for another project loses access", () => {
  assert.equal(canAccessSession(owner, { owner_id: "owner", project: "other" }), false);
});

test("only admins review runs", () => {
  assert.equal(canReviewRun(admin), true);
  assert.equal(canReviewRun(owner), false);
});

test("write access follows the write grant", () => {
  assert.equal(canWriteProject(owner, "ijra"), true);
  assert.equal(canWriteProject(owner, "other"), false);
  assert.equal(canWriteProject(admin, "anything"), true);
});
