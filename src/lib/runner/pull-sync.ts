export type PullSummary = {
  html_url: string;
  state: string;
  merged?: boolean | null;
  merged_at?: string | null;
};

export type PullRunState =
  | { status: "merged"; prUrl: string }
  | { status: "closed"; prUrl: string }
  | { status: "awaiting_review"; prUrl: string; safeZone: null };

export function runStateFromPull(pr: PullSummary): PullRunState {
  if (pr.merged === true || pr.merged_at) return { status: "merged", prUrl: pr.html_url };
  if (pr.state === "closed") return { status: "closed", prUrl: pr.html_url };
  return { status: "awaiting_review", prUrl: pr.html_url, safeZone: null };
}

export type PullAction = "closed" | "reopened";

export interface PullEvent {
  repo: string;
  branch: string;
  action: PullAction;
  merged: boolean;
  prUrl: string;
  delivery: string | null;
}

export function pullEventFrom(payload: unknown, delivery: string | null = null): PullEvent | null {
  if (!isRecord(payload)) return null;
  const action = payload.action;
  if (action !== "closed" && action !== "reopened") return null;
  const repository = payload.repository;
  const pull = payload.pull_request;
  if (!isRecord(repository) || typeof repository.full_name !== "string") return null;
  if (!isRecord(pull)) return null;
  const head = pull.head;
  if (!isRecord(head) || typeof head.ref !== "string") return null;
  if (typeof pull.html_url !== "string") return null;
  return {
    repo: repository.full_name,
    branch: head.ref,
    action,
    merged: action === "closed" && pull.merged === true,
    prUrl: pull.html_url,
    delivery,
  };
}

export function pullStatusMessage(status: "merged" | "closed", prUrl: string) {
  return status === "merged" ? `Merged: ${prUrl}` : `Pull request closed without merging: ${prUrl}`;
}

const SETTLED = new Set(["done", "merged", "closed", "failed", "cancelled", "answered", "no_changes", "blocked", "rejected"]);
const REVIEW_SYNC_MS = 60_000;

export function shouldSyncRun(run: { status: string; agent_msg: number; updated_at: number }, now = Date.now()) {
  if (SETTLED.has(run.status)) return false;
  if (run.status === "awaiting_review") return now - run.updated_at >= REVIEW_SYNC_MS;
  return !run.agent_msg;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
