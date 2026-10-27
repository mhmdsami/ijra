import assert from "node:assert/strict";
import { test } from "node:test";
import { canRetry, canTransition } from "./transitions.ts";

test("awaiting review can be merged or rejected", () => {
  assert.equal(canTransition("awaiting_review", "merged"), true);
  assert.equal(canTransition("awaiting_review", "rejected"), true);
  assert.equal(canTransition("awaiting_review", "closed"), true);
});

test("a merged run cannot be rejected or retried", () => {
  assert.equal(canTransition("merged", "rejected"), false);
  assert.equal(canRetry("merged"), false);
});

test("response states are not review actions", () => {
  assert.equal(canTransition("answered", "merged"), false);
  assert.equal(canTransition("no_changes", "merged"), false);
});

test("terminal failures can be retried but not merged", () => {
  for (const status of ["failed", "cancelled", "rejected", "blocked", "closed"]) {
    assert.equal(canRetry(status), true, status);
    assert.equal(canTransition(status, "merged"), false, status);
  }
});

test("active and review states cannot be retried", () => {
  for (const status of ["dispatching", "running", "awaiting_review", "merged", "answered", "no_changes", "done"]) {
    assert.equal(canRetry(status), false, status);
  }
});

test("dispatching can reach running and terminal outcomes", () => {
  assert.equal(canTransition("dispatching", "running"), true);
  assert.equal(canTransition("dispatching", "failed"), true);
  assert.equal(canTransition("dispatching", "merged"), false);
});
