import assert from "node:assert/strict";
import { test } from "node:test";
import type { MessageRow, RunRow } from "../db.ts";
import { anchorMessageId, pendingBlockedRun, prCardGroups } from "./session-timeline.ts";

function run(overrides: Partial<RunRow>): RunRow {
  return {
    id: "run-1",
    session_id: "s",
    project: "ijra",
    request: "x",
    model: "m",
    mode: "auto",
    status: "awaiting_review",
    gh_run_id: null,
    gh_run_url: null,
    pr_url: null,
    branch: null,
    safe_zone: null,
    agent_msg: 1,
    dispatch_at: 100,
    updated_at: 100,
    requested_by: "u",
    parent_run_id: null,
    policy_status: "passed",
    policy_reasons: null,
    checks_status: null,
    input_tokens: 0,
    output_tokens: 0,
    cache_read_tokens: 0,
    cache_write_tokens: 0,
    cost_usd: 0,
    model_calls: 0,
    decision: null,
    decided_by: null,
    decided_at: null,
    decision_reason: null,
    error_detail: null,
    ...overrides,
  };
}

function message(overrides: Partial<MessageRow>): MessageRow {
  return {
    id: 1,
    session_id: "s",
    role: "agent",
    content: "x",
    meta: null,
    run_id: null,
    created_at: 100,
    ...overrides,
  };
}

test("groups runs by pull request and keeps the first and latest", () => {
  const groups = prCardGroups([
    run({ id: "a", pr_url: "https://x/1", dispatch_at: 10 }),
    run({ id: "b", pr_url: "https://x/1", dispatch_at: 20, status: "merged" }),
    run({ id: "c", pr_url: "https://x/2", dispatch_at: 30 }),
    run({ id: "d", pr_url: null, dispatch_at: 40 }),
  ]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].url, "https://x/1");
  assert.equal(groups[0].firstRun.id, "a");
  assert.equal(groups[0].latestRun.id, "b");
  assert.equal(groups[0].latestRun.status, "merged");
  assert.equal(groups[1].firstRun.id, "c");
});

test("anchors a card to the agent message for its first run", () => {
  const group = prCardGroups([run({ id: "a", pr_url: "https://x/1" })])[0];
  const messages = [message({ id: 1, run_id: "other" }), message({ id: 2, run_id: "a" })];
  assert.equal(anchorMessageId(group, messages), 2);
});

test("falls back to the first agent message after dispatch", () => {
  const group = prCardGroups([run({ id: "a", pr_url: "https://x/1", dispatch_at: 50 })])[0];
  const messages = [
    message({ id: 1, created_at: 40 }),
    message({ id: 2, created_at: 60 }),
    message({ id: 3, created_at: 70 }),
  ];
  assert.equal(anchorMessageId(group, messages), 2);
});

test("returns null when no message can anchor the card", () => {
  const group = prCardGroups([run({ id: "a", pr_url: "https://x/1", dispatch_at: 50 })])[0];
  assert.equal(anchorMessageId(group, [message({ id: 1, created_at: 40 })]), null);
});

test("surfaces a blocked run only while it is the latest attempt", () => {
  const blocked = run({ id: "a", status: "blocked", dispatch_at: 10 });
  assert.equal(pendingBlockedRun([blocked]), blocked);
  assert.equal(pendingBlockedRun([blocked, run({ id: "b", status: "answered", dispatch_at: 20 })]), undefined);
  assert.equal(
    pendingBlockedRun([blocked, run({ id: "c", status: "awaiting_review", dispatch_at: 30, pr_url: "https://x/1" })]),
    undefined,
  );
});

test("ignores an empty run list and a blocked run that already has a pull request", () => {
  assert.equal(pendingBlockedRun([]), undefined);
  assert.equal(pendingBlockedRun([run({ status: "blocked", pr_url: "https://x/1" })]), undefined);
});
