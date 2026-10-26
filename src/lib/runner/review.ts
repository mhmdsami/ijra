export interface PullSnapshot {
  state: string;
  merged?: boolean | null;
  mergeable?: boolean | null;
  changed_files?: number | null;
  head: { sha: string };
}

export interface CheckRunSummary {
  status: string;
  conclusion: string | null;
}

export interface CheckSummary {
  checkRuns: CheckRunSummary[];
  combinedState: string | null;
  combinedCount?: number;
}

export interface PullFile {
  filename: string;
  additions: number;
  deletions: number;
}

export interface ReviewInput {
  pull: PullSnapshot;
  checks: CheckSummary;
  files: PullFile[];
  policyStatus: string;
}

export interface ReviewResult {
  ok: boolean;
  reasons: string[];
}

const FAILING_CONCLUSIONS = new Set(["failure", "timed_out", "cancelled", "action_required", "startup_failure"]);

export function checkState(checks: CheckSummary) {
  const pending = checks.checkRuns.filter((run) => run.status !== "completed").length;
  const failing = checks.checkRuns.filter((run) => run.status === "completed" && FAILING_CONCLUSIONS.has(run.conclusion ?? "")).length;
  const combined = checks.combinedCount === undefined || checks.combinedCount > 0;
  const combinedFailing = combined && (checks.combinedState === "failure" || checks.combinedState === "error") ? 1 : 0;
  const combinedPending = combined && checks.combinedState === "pending" ? 1 : 0;
  return {
    total: checks.checkRuns.length,
    pending: pending + combinedPending,
    failing: failing + combinedFailing,
  };
}

export type CheckOutcome = "passing" | "failing" | "pending" | "none";

export function checkOutcome(checks: CheckSummary): CheckOutcome {
  const state = checkState(checks);
  if (state.failing > 0) return "failing";
  if (state.pending > 0) return "pending";
  if (state.total > 0 || checks.combinedState === "success") return "passing";
  return "none";
}

export function reviewMerge(input: ReviewInput): ReviewResult {
  const reasons: string[] = [];

  if (input.pull.merged) reasons.push("the pull request is already merged");
  else if (input.pull.state !== "open") reasons.push("the pull request is not open");
  if (input.pull.mergeable === false) reasons.push("GitHub reports the pull request has conflicts");
  if (input.policyStatus === "blocked") reasons.push("the run is blocked by policy");

  const checks = checkState(input.checks);
  if (checks.failing > 0) reasons.push(`${checks.failing} check${checks.failing === 1 ? "" : "s"} failing`);
  if (checks.pending > 0) reasons.push(`${checks.pending} check${checks.pending === 1 ? "" : "s"} still running`);

  const files = input.pull.changed_files ?? input.files.length;
  if (files > 12) reasons.push(`${files} files changed; the limit is 12`);
  const lines = input.files.reduce((total, file) => total + file.additions + file.deletions, 0);
  if (lines > 400) reasons.push(`${lines} lines changed; the limit is 400`);

  return { ok: reasons.length === 0, reasons };
}

export function pullNumberFrom(url: string) {
  const match = url.match(/\/pull\/(\d+)(?:$|[/?#])/);
  return match ? Number.parseInt(match[1], 10) : null;
}
