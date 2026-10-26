import { test } from "node:test";
import assert from "node:assert/strict";
import { acceptsReport, parseRunnerReport, reportFingerprint, reportMessage, reportStatus } from "./report.ts";

test("parses a valid runner report", () => {
  const report = parseRunnerReport({
    runId: "run-1",
    status: "awaiting_review",
    summary: "Done",
    outcome: { prUrl: "https://example.test/pr/1", branch: "ft-1-x" },
  });
  assert.equal(report?.runId, "run-1");
  assert.equal(report?.outcome?.prUrl, "https://example.test/pr/1");
});

test("rejects malformed reports", () => {
  assert.equal(parseRunnerReport(null), null);
  assert.equal(parseRunnerReport([]), null);
  assert.equal(parseRunnerReport({}), null);
  assert.equal(parseRunnerReport({ runId: "run-1" }), null);
  assert.equal(parseRunnerReport({ status: "failed" }), null);
  assert.equal(parseRunnerReport({ runId: 1, status: "failed" }), null);
});

test("ignores a non-object outcome", () => {
  assert.equal(parseRunnerReport({ runId: "r", status: "failed", outcome: "no" })?.outcome, undefined);
});

test("keeps every allowlisted status", () => {
  for (const status of ["answered", "no_changes", "awaiting_review", "failed", "blocked"]) {
    assert.equal(reportStatus(status), status);
  }
});

test("coerces unknown or dashboard-only statuses to failed", () => {
  for (const status of ["merged", "rejected", "cancelled", "running", "bogus", ""]) {
    assert.equal(reportStatus(status), "failed", status);
  }
});

test("only dispatching, running, and failed runs accept a report", () => {
  for (const status of ["dispatching", "running", "failed"]) assert.equal(acceptsReport(status), true, status);
  for (const status of ["awaiting_review", "merged", "rejected", "closed", "cancelled", "blocked", "answered", "no_changes", "done"]) {
    assert.equal(acceptsReport(status), false, status);
  }
});

test("a non-failed report stores its summary", () => {
  assert.deepEqual(reportMessage({ status: "answered", summary: " Here is the answer. " }), {
    visible: "Here is the answer.",
    errorDetail: null,
  });
  assert.deepEqual(reportMessage({ status: "awaiting_review", summary: "  " }), { visible: null, errorDetail: null });
});

test("a failed report always shows the standard line and stores the detail", () => {
  assert.deepEqual(reportMessage({ status: "failed", summary: "Run failed: boom" }), {
    visible: "The run failed before it could reply.",
    errorDetail: "boom",
  });
  assert.deepEqual(reportMessage({ status: "failed", error: " runner crashed " }), {
    visible: "The run failed before it could reply.",
    errorDetail: "runner crashed",
  });
  assert.equal(reportMessage({ status: "failed" }).errorDetail, "The run failed before it could reply.");
});

test("caps stored error detail at 4000 characters", () => {
  const detail = reportMessage({ status: "failed", error: "x".repeat(5000) }).errorDetail;
  assert.equal(detail?.length, 4000);
});

test("fingerprints the timestamp and body deterministically", async () => {
  const first = await reportFingerprint("1700000000", '{"runId":"r"}');
  assert.equal(first, await reportFingerprint("1700000000", '{"runId":"r"}'));
  assert.match(first, /^[0-9a-f]{64}$/);
  assert.notEqual(first, await reportFingerprint("1700000001", '{"runId":"r"}'));
  assert.notEqual(first, await reportFingerprint("1700000000", '{"runId":"r2"}'));
});
