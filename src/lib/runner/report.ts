export const REPORT_STATUSES = ["answered", "no_changes", "awaiting_review", "failed", "blocked"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REPORTABLE_RUN_STATUSES = ["dispatching", "running", "failed"] as const;

export interface RunnerReport {
  runId: string;
  status: string;
  summary?: string;
  outcome?: {
    prUrl?: string;
    branch?: string;
    policyReasons?: string[];
    title?: string;
    error?: string;
    usage?: unknown;
  };
}

export function parseRunnerReport(payload: unknown): RunnerReport | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const value = payload as Record<string, unknown>;
  if (typeof value.runId !== "string" || !value.runId) return null;
  if (typeof value.status !== "string" || !value.status) return null;
  const outcome = value.outcome;
  return {
    runId: value.runId,
    status: value.status,
    summary: typeof value.summary === "string" ? value.summary : undefined,
    outcome:
      outcome && typeof outcome === "object" && !Array.isArray(outcome)
        ? (outcome as RunnerReport["outcome"])
        : undefined,
  };
}

export function reportStatus(status: string): ReportStatus {
  return (REPORT_STATUSES as readonly string[]).includes(status) ? (status as ReportStatus) : "failed";
}

export function acceptsReport(runStatus: string) {
  return (REPORTABLE_RUN_STATUSES as readonly string[]).includes(runStatus);
}

export function reportMessage(input: { status: ReportStatus; summary?: string; error?: string }) {
  const summary = input.summary?.trim();
  if (input.status !== "failed") {
    return { visible: summary || null, errorDetail: null };
  }
  const errorDetail = (
    input.error?.trim() ||
    summary?.replace(/^Run failed:\s*/, "") ||
    "The run failed before it could reply."
  ).slice(0, 4000);
  return { visible: "The run failed before it could reply.", errorDetail };
}

export async function reportFingerprint(timestamp: string, body: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${timestamp}.${body}`));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
