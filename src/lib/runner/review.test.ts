import assert from "node:assert/strict";
import { test } from "node:test";
import { checkOutcome, checkState, pullNumberFrom, type ReviewInput, reviewMerge } from "./review.ts";

function input(overrides: Partial<ReviewInput> = {}): ReviewInput {
  return {
    pull: { state: "open", merged: false, mergeable: true, changed_files: 2, head: { sha: "abc" } },
    checks: { checkRuns: [{ status: "completed", conclusion: "success" }], combinedState: "success" },
    files: [
      { filename: "src/a.ts", additions: 10, deletions: 2 },
      { filename: "src/b.ts", additions: 5, deletions: 1 },
    ],
    policyStatus: "passed",
    ...overrides,
  };
}

test("accepts an open, green, in-budget pull request", () => {
  assert.deepEqual(reviewMerge(input()), { ok: true, reasons: [] });
});

test("blocks a pull that is not open", () => {
  const result = reviewMerge(
    input({ pull: { state: "closed", merged: false, changed_files: 1, head: { sha: "abc" } } }),
  );
  assert.equal(result.ok, false);
  assert.match(result.reasons.join("; "), /not open/);
});

test("blocks an already-merged pull", () => {
  const result = reviewMerge(
    input({ pull: { state: "closed", merged: true, changed_files: 1, head: { sha: "abc" } } }),
  );
  assert.match(result.reasons.join("; "), /already merged/);
});

test("blocks a conflicting pull", () => {
  const result = reviewMerge(
    input({ pull: { state: "open", merged: false, mergeable: false, changed_files: 1, head: { sha: "abc" } } }),
  );
  assert.match(result.reasons.join("; "), /conflicts/);
});

test("blocks a policy-blocked run", () => {
  assert.match(reviewMerge(input({ policyStatus: "blocked" })).reasons.join("; "), /blocked by policy/);
});

test("blocks while checks are running", () => {
  const result = reviewMerge(
    input({ checks: { checkRuns: [{ status: "in_progress", conclusion: null }], combinedState: null } }),
  );
  assert.match(result.reasons.join("; "), /still running/);
});

test("blocks a failing check run", () => {
  const result = reviewMerge(
    input({ checks: { checkRuns: [{ status: "completed", conclusion: "failure" }], combinedState: null } }),
  );
  assert.match(result.reasons.join("; "), /1 check failing/);
});

test("blocks a failing combined status", () => {
  const result = reviewMerge(input({ checks: { checkRuns: [], combinedState: "failure", combinedCount: 1 } }));
  assert.match(result.reasons.join("; "), /1 check failing/);
});

test("ignores an empty combined status instead of blocking forever", () => {
  const result = reviewMerge(input({ checks: { checkRuns: [], combinedState: "pending", combinedCount: 0 } }));
  assert.deepEqual(result, { ok: true, reasons: [] });
});

test("blocks more than twelve changed files", () => {
  const result = reviewMerge(
    input({ pull: { state: "open", merged: false, changed_files: 13, head: { sha: "abc" } } }),
  );
  assert.match(result.reasons.join("; "), /13 files changed/);
});

test("blocks more than four hundred changed lines", () => {
  const result = reviewMerge(input({ files: [{ filename: "src/a.ts", additions: 300, deletions: 101 }] }));
  assert.match(result.reasons.join("; "), /401 lines changed/);
});

test("counts pending and failing checks together", () => {
  assert.deepEqual(
    checkState({
      checkRuns: [
        { status: "completed", conclusion: "success" },
        { status: "queued", conclusion: null },
        { status: "completed", conclusion: "timed_out" },
      ],
      combinedState: "pending",
    }),
    { total: 3, pending: 2, failing: 1 },
  );
});

test("extracts the pull number from a PR URL", () => {
  assert.equal(pullNumberFrom("https://github.com/owner/repo/pull/42"), 42);
  assert.equal(pullNumberFrom("https://github.com/owner/repo/pull/42/files"), 42);
  assert.equal(pullNumberFrom("https://github.com/owner/repo/issues/42"), null);
  assert.equal(pullNumberFrom(""), null);
});

test("summarises check state for the card", () => {
  assert.equal(checkOutcome({ checkRuns: [], combinedState: "pending", combinedCount: 0 }), "none");
  assert.equal(
    checkOutcome({ checkRuns: [{ status: "completed", conclusion: "success" }], combinedState: "success" }),
    "passing",
  );
  assert.equal(checkOutcome({ checkRuns: [], combinedState: "success", combinedCount: 1 }), "passing");
  assert.equal(
    checkOutcome({ checkRuns: [{ status: "completed", conclusion: "failure" }], combinedState: null }),
    "failing",
  );
  assert.equal(
    checkOutcome({ checkRuns: [{ status: "in_progress", conclusion: null }], combinedState: null }),
    "pending",
  );
});
