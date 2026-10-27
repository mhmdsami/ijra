import { setRunStatus, updateRun } from "../../db";
import { env } from "../../env";
import { projectConfig, RUNNER_REPO } from "../projects";
import { runStateFromPull } from "./pull-sync";
import {
  type CheckOutcome,
  type CheckRunSummary,
  type CheckSummary,
  checkOutcome,
  type PullFile,
  pullNumberFrom,
  reviewMerge,
} from "./review";
import type { RunState } from "./types";

type GHRun = { status: string; conclusion: string | null; html_url: string };
type GHPull = {
  html_url: string;
  state: string;
  merged?: boolean | null;
  merged_at?: string | null;
  head: { ref: string };
  body: string | null;
};
type GHPullDetail = GHPull & {
  mergeable?: boolean | null;
  changed_files?: number | null;
  head: { ref: string; sha: string };
};

export type SyncResult = RunState & { agentSummary: string | null; changed: boolean };

async function gh<T>(path: string, init?: RequestInit): Promise<T | null> {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env().GITHUB_PAT}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "ijra-worker",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 404) return null;
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`GitHub API ${res.status} on ${path}: ${await res.text()}`);
  return (await res.json()) as T;
}

export async function startRun(input: {
  project: string;
  request: string;
  session: string;
  model: string;
  mode: "fix" | "ask" | "auto";
  runId: string;
  imageUrls?: string[];
}) {
  await gh(`/repos/${RUNNER_REPO}/actions/workflows/dispatch.yml/dispatches`, {
    method: "POST",
    body: JSON.stringify({
      ref: "main",
      inputs: {
        project: input.project,
        request: input.request,
        session: input.session,
        model: input.model,
        mode: input.mode,
        run_id: input.runId,
        images: JSON.stringify(input.imageUrls ?? []),
      },
    }),
  });
}

export async function cancelRun(run: { ghRunId: number | null }) {
  if (run.ghRunId) {
    await gh(`/repos/${RUNNER_REPO}/actions/runs/${run.ghRunId}/cancel`, { method: "POST" });
  }
}

export interface PullReview {
  ok: boolean;
  reasons: string[];
  number: number | null;
  sha: string | null;
}

export async function inspectPull(repo: string, prUrl: string, policyStatus: string): Promise<PullReview> {
  const number = pullNumberFrom(prUrl);
  if (!number) return { ok: false, reasons: ["the pull request URL is not recognised"], number: null, sha: null };
  const pull = await gh<GHPullDetail>(`/repos/${repo}/pulls/${number}`);
  if (!pull) return { ok: false, reasons: ["the pull request no longer exists"], number, sha: null };

  const [files, checks] = await Promise.all([
    gh<PullFile[]>(`/repos/${repo}/pulls/${number}/files?per_page=100`),
    readChecks(repo, pull.head.sha),
  ]);

  const review = reviewMerge({
    pull,
    checks,
    files: (files ?? []).map((file) => ({
      filename: file.filename,
      additions: file.additions,
      deletions: file.deletions,
    })),
    policyStatus,
  });

  return { ...review, number, sha: pull.head.sha };
}

async function readChecks(repo: string, sha: string): Promise<CheckSummary> {
  const [checks, combined] = await Promise.all([
    gh<{ check_runs: CheckRunSummary[] }>(`/repos/${repo}/commits/${sha}/check-runs?per_page=100`),
    gh<{ state: string; total_count: number }>(`/repos/${repo}/commits/${sha}/status`),
  ]);
  return {
    checkRuns: checks?.check_runs ?? [],
    combinedState: combined?.state ?? null,
    combinedCount: combined?.total_count ?? 0,
  };
}

export async function pullChecks(repo: string, prUrl: string): Promise<CheckOutcome> {
  const number = pullNumberFrom(prUrl);
  if (!number) return "none";
  const pull = await gh<{ head: { sha: string } }>(`/repos/${repo}/pulls/${number}`);
  if (!pull?.head?.sha) return "none";
  return checkOutcome(await readChecks(repo, pull.head.sha));
}

async function persistChecks(runId: string, repo: string, prUrl: string) {
  const outcome = await pullChecks(repo, prUrl).catch(() => null);
  if (outcome) await updateRun(runId, { checks_status: outcome });
}

export async function mergePull(repo: string, number: number, sha: string) {
  const result = await gh<{ merged: boolean; message: string }>(`/repos/${repo}/pulls/${number}/merge`, {
    method: "PUT",
    body: JSON.stringify({ merge_method: "squash", sha }),
  });
  if (!result?.merged) throw new Error(result?.message || "GitHub did not merge the pull request");
  return result;
}

export async function syncRun(run: {
  id: string;
  project: string;
  session: string;
  status: string;
  mode: "fix" | "ask" | "auto";
  ghRunId: number | null;
  dispatchAt: number;
  branch: string | null;
}): Promise<SyncResult> {
  const cfg = projectConfig(run.project);

  if (run.status === "awaiting_review") {
    const pr = await findPr(cfg.repo, run.session, run.branch);
    if (!pr) return { status: "awaiting_review", prUrl: null, safeZone: null, agentSummary: null, changed: false };
    const state = runStateFromPull(pr);
    if (state.status === "awaiting_review") await persistChecks(run.id, cfg.repo, pr.html_url);
    const changed =
      state.status === "awaiting_review"
        ? false
        : await setRunStatus({
            id: run.id,
            from: ["awaiting_review"],
            to: state.status,
            prUrl: pr.html_url,
            branch: pr.head.ref,
            action: `run.${state.status}`,
          });
    return { ...state, agentSummary: agentSummaryFrom(pr.body ?? ""), changed };
  }

  let ghRunId = run.ghRunId;

  if (!ghRunId) {
    const resolved = await resolveRunId(run.dispatchAt);
    if (!resolved) return { status: "dispatching", agentSummary: null, changed: false };
    ghRunId = resolved.id;
    await updateRun(run.id, { gh_run_id: resolved.id, gh_run_url: resolved.html_url });
  }

  const ghRun = await gh<GHRun>(`/repos/${RUNNER_REPO}/actions/runs/${ghRunId}`);
  if (!ghRun) {
    const changed = await setRunStatus({
      id: run.id,
      from: [run.status],
      to: "failed",
      runUrl: null,
      action: "run.failed",
    });
    return { status: "failed", runUrl: null, agentSummary: null, changed };
  }

  if (ghRun.status !== "completed") {
    const changed =
      run.status === "dispatching"
        ? await setRunStatus({ id: run.id, from: ["dispatching"], to: "running", action: "run.running" })
        : false;
    return { status: "running", agentSummary: null, changed };
  }

  if (ghRun.conclusion === "cancelled") {
    const changed = await setRunStatus({
      id: run.id,
      from: [run.status],
      to: "cancelled",
      runUrl: ghRun.html_url,
      action: "run.cancelled",
    });
    return { status: "cancelled", runUrl: ghRun.html_url, agentSummary: null, changed };
  }

  if (ghRun.conclusion !== "success") {
    const changed = await setRunStatus({
      id: run.id,
      from: [run.status],
      to: "failed",
      runUrl: ghRun.html_url,
      action: "run.failed",
    });
    return { status: "failed", runUrl: ghRun.html_url, agentSummary: null, changed };
  }

  const pr = await findPr(cfg.repo, run.session, run.branch);
  if (!pr) {
    const changed = await setRunStatus({ id: run.id, from: [run.status], to: "done", action: "run.done" });
    return { status: "done", prUrl: null, safeZone: null, agentSummary: null, changed };
  }

  const state = runStateFromPull(pr);
  if (state.status === "awaiting_review") await persistChecks(run.id, cfg.repo, pr.html_url);
  const changed = await setRunStatus({
    id: run.id,
    from: [run.status],
    to: state.status,
    prUrl: pr.html_url,
    branch: pr.head.ref,
    action: `run.${state.status}`,
  });
  return { ...state, agentSummary: agentSummaryFrom(pr.body ?? ""), changed };
}

async function resolveRunId(dispatchAt: number) {
  const data = await gh<{ workflow_runs: { id: number; created_at: string; html_url: string; event: string }[] }>(
    `/repos/${RUNNER_REPO}/actions/workflows/dispatch.yml/runs?per_page=10`,
  );
  if (!data) return null;
  const cutoff = new Date(dispatchAt - 60_000).toISOString();
  const match = data.workflow_runs.find((r) => r.event === "workflow_dispatch" && r.created_at >= cutoff);
  return match ? { id: match.id, html_url: match.html_url } : null;
}

async function findPr(repo: string, session: string, branch: string | null) {
  if (branch) {
    const owner = repo.split("/")[0];
    const pulls = await gh<GHPull[]>(
      `/repos/${repo}/pulls?state=all&head=${encodeURIComponent(`${owner}:${branch}`)}&per_page=1`,
    );
    if (pulls?.length) return pulls[0];
  }
  const shortSession = session.slice(0, 8);
  if (!shortSession) return null;
  const pulls = await gh<GHPull[]>(`/repos/${repo}/pulls?state=all&sort=created&direction=desc&per_page=15`);
  return pulls?.find((p) => p.head.ref.includes(shortSession)) ?? null;
}

function agentSummaryFrom(body: string) {
  const stops = [body.indexOf("\n\n---\nSession:"), body.indexOf("\n| | |")].filter((index) => index !== -1);
  const stop = stops.length ? Math.min(...stops) : -1;
  return (stop === -1 ? body : body.slice(0, stop)).trim() || null;
}
