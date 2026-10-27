import assert from "node:assert/strict";
import { test } from "node:test";
import { pullEventFrom, pullStatusMessage, runStateFromPull, shouldSyncRun } from "./pull-sync.ts";

test("maps a merged pull from the list response", () => {
  assert.deepEqual(
    runStateFromPull({ state: "closed", merged_at: "2026-10-25T18:20:31Z", html_url: "https://github.com/o/r/pull/1" }),
    { status: "merged", prUrl: "https://github.com/o/r/pull/1" },
  );
});

test("maps a merged pull from a webhook payload", () => {
  assert.deepEqual(
    runStateFromPull({ state: "closed", merged: true, merged_at: null, html_url: "https://github.com/o/r/pull/1" }),
    { status: "merged", prUrl: "https://github.com/o/r/pull/1" },
  );
});

test("maps a closed pull without a merge", () => {
  assert.deepEqual(
    runStateFromPull({ state: "closed", merged: false, merged_at: null, html_url: "https://github.com/o/r/pull/1" }),
    { status: "closed", prUrl: "https://github.com/o/r/pull/1" },
  );
});

test("maps an open pull to awaiting review", () => {
  assert.equal(
    runStateFromPull({ state: "open", merged: false, merged_at: null, html_url: "https://github.com/o/r/pull/1" })
      .status,
    "awaiting_review",
  );
});

test("extracts a closed merged event", () => {
  assert.deepEqual(
    pullEventFrom(
      {
        action: "closed",
        repository: { full_name: "mhmdsami/play-with-ijra" },
        pull_request: {
          html_url: "https://github.com/mhmdsami/play-with-ijra/pull/1",
          merged: true,
          head: { ref: "ft-session-slug" },
        },
      },
      "delivery-1",
    ),
    {
      repo: "mhmdsami/play-with-ijra",
      branch: "ft-session-slug",
      action: "closed",
      merged: true,
      prUrl: "https://github.com/mhmdsami/play-with-ijra/pull/1",
      delivery: "delivery-1",
    },
  );
});

test("extracts a reopened event", () => {
  const event = pullEventFrom({
    action: "reopened",
    repository: { full_name: "mhmdsami/play-with-ijra" },
    pull_request: {
      html_url: "https://github.com/mhmdsami/play-with-ijra/pull/1",
      merged: false,
      head: { ref: "ft-session-slug" },
    },
  });
  assert.equal(event?.action, "reopened");
  assert.equal(event?.merged, false);
});

test("ignores unrelated actions and malformed payloads", () => {
  assert.equal(
    pullEventFrom({
      action: "opened",
      repository: { full_name: "o/r" },
      pull_request: { head: { ref: "b" }, html_url: "u" },
    }),
    null,
  );
  assert.equal(pullEventFrom({ action: "closed" }), null);
  assert.equal(pullEventFrom("closed"), null);
});

test("awaiting review syncs after the interval, not before", () => {
  const now = 1_000_000;
  assert.equal(shouldSyncRun({ status: "awaiting_review", agent_msg: 1, updated_at: now - 61_000 }, now), true);
  assert.equal(shouldSyncRun({ status: "awaiting_review", agent_msg: 1, updated_at: now - 59_000 }, now), false);
});

test("settled runs never sync", () => {
  for (const status of [
    "done",
    "merged",
    "closed",
    "failed",
    "cancelled",
    "answered",
    "no_changes",
    "blocked",
    "rejected",
  ]) {
    assert.equal(shouldSyncRun({ status, agent_msg: 1, updated_at: 0 }, 1_000_000), false, status);
  }
});

test("an active run without a delivered message syncs", () => {
  assert.equal(shouldSyncRun({ status: "running", agent_msg: 0, updated_at: 0 }), true);
  assert.equal(shouldSyncRun({ status: "dispatching", agent_msg: 0, updated_at: 0 }), true);
});

test("active runs sync at most every five seconds", () => {
  const now = 1_000_000;
  assert.equal(shouldSyncRun({ status: "running", agent_msg: 0, updated_at: now - 4_999 }, now), false);
  assert.equal(shouldSyncRun({ status: "running", agent_msg: 0, updated_at: now - 5_000 }, now), true);
  assert.equal(shouldSyncRun({ status: "dispatching", agent_msg: 0, updated_at: now - 1_000 }, now), false);
  assert.equal(shouldSyncRun({ status: "running", agent_msg: 1, updated_at: now - 60_000 }, now), false);
});

test("status messages stay consistent with the fallback", () => {
  assert.equal(pullStatusMessage("merged", "https://example.test/pull/1"), "Merged: https://example.test/pull/1");
  assert.equal(
    pullStatusMessage("closed", "https://example.test/pull/1"),
    "Pull request closed without merging: https://example.test/pull/1",
  );
});
