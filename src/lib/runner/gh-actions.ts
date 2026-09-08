import { env } from "../../env";
import { updateRun } from "../../db";
import { RUNNER_REPO, projectConfig } from "../projects";
import type { RunState } from "./types";

type GHRun = { status: string; conclusion: string | null; html_url: string };
type GHPull = {
  html_url: string;
  state: string;
  merged: boolean;
  head: { ref: string };
  body: string | null;
};

export type SyncResult = RunState & { agentSummary: string | null };

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
      },
    }),
  });
}

export async function mergeRun(input: { repo: string; prUrl: string }) {
  const prNumber = input.prUrl.match(/\/pull\/(\d+)/)?.[1];
  if (!prNumber) throw new Error("cannot parse PR number from URL");
  await gh(`/repos/${input.repo}/pulls/${prNumber}/merge`, {
    method: "PUT",
    body: JSON.stringify({ merge_method: "squash" }),
  });
}

export async function cancelRun(run: { ghRunId: number | null }) {
  if (run.ghRunId) {
    await gh(`/repos/${RUNNER_REPO}/actions/runs/${run.ghRunId}/cancel`, { method: "POST" });
  }
}

export async function syncRun(run: {
  id: string;
  project: string;
  session: string;
  status: string;
  mode: "fix" | "ask" | "auto";
  ghRunId: number | null;
  dispatchAt: number;
}): Promise<SyncResult> {
  let ghRunId = run.ghRunId;

  if (!ghRunId) {
    const resolved = await resolveRunId(run.dispatchAt);
    if (!resolved) return { status: "dispatching", agentSummary: null };
    ghRunId = resolved.id;
    await updateRun(run.id, { gh_run_id: resolved.id, gh_run_url: resolved.html_url, status: "running" });
  }

  const ghRun = await gh<GHRun>(`/repos/${RUNNER_REPO}/actions/runs/${ghRunId}`);
  if (!ghRun) return { status: "failed", runUrl: null, agentSummary: null };

  if (ghRun.status !== "completed") {
    await updateRun(run.id, { gh_run_url: ghRun.html_url, status: "running" });
    return { status: "running", agentSummary: null };
  }

  if (ghRun.conclusion === "cancelled") {
    await updateRun(run.id, { status: "cancelled", gh_run_url: ghRun.html_url });
    return { status: "cancelled", runUrl: ghRun.html_url, agentSummary: null };
  }

  if (ghRun.conclusion !== "success") {
    await updateRun(run.id, { status: "failed", gh_run_url: ghRun.html_url });
    return { status: "failed", runUrl: ghRun.html_url, agentSummary: null };
  }

  const cfg = projectConfig(run.project);
  const pr = await findPr(cfg.repo, run.session);
  if (!pr) {
    await updateRun(run.id, { status: "done" });
    return { status: "done", prUrl: null, safeZone: null, agentSummary: null };
  }

  const state: RunState =
    pr.state === "closed" && pr.merged
      ? { status: "merged", prUrl: pr.html_url }
      : { status: "awaiting_review", prUrl: pr.html_url, safeZone: null };

  await updateRun(run.id, { status: state.status, pr_url: pr.html_url, branch: pr.head.ref });
  return { ...state, agentSummary: agentSummaryFrom(pr.body ?? "") };
}

async function resolveRunId(dispatchAt: number) {
  const data = await gh<{ workflow_runs: { id: number; created_at: string; html_url: string; event: string }[] }>(
    `/repos/${RUNNER_REPO}/actions/workflows/dispatch.yml/runs?per_page=10`
  );
  if (!data) return null;
  const cutoff = new Date(dispatchAt - 60_000).toISOString();
  const match = data.workflow_runs.find((r) => r.event === "workflow_dispatch" && r.created_at >= cutoff);
  return match ? { id: match.id, html_url: match.html_url } : null;
}

async function findPr(repo: string, session: string) {
  const pulls = await gh<GHPull[]>(`/repos/${repo}/pulls?state=all&sort=created&direction=desc&per_page=15`);
  return pulls?.find((p) => new RegExp(`^(ft|fx|ch|rf)-${session}-`).test(p.head.ref)) ?? null;
}

function agentSummaryFrom(body: string) {
  const table = body.indexOf("\n| | |");
  const footer = body.indexOf("Automated by");
  const stop = [table, footer].filter((i) => i !== -1).sort((a, b) => a - b)[0];
  return (stop === undefined ? body : body.slice(0, stop)).trim() || null;
}
