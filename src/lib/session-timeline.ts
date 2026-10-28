import type { MessageRow, RunRow } from "@/db";

export interface PrCardGroup {
  url: string;
  firstRun: RunRow;
  latestRun: RunRow;
}

/** One card per pull request, in the order its first run was dispatched. */
export function prCardGroups(runs: RunRow[]): PrCardGroup[] {
  const groups = new Map<string, PrCardGroup>();
  for (const run of runs) {
    if (!run.pr_url) continue;
    const existing = groups.get(run.pr_url);
    if (existing) {
      existing.latestRun = run;
    } else {
      groups.set(run.pr_url, { url: run.pr_url, firstRun: run, latestRun: run });
    }
  }
  return [...groups.values()];
}

/** The agent message that announced the PR, falling back to the first agent message after dispatch. */
export function anchorMessageId(group: PrCardGroup, messages: MessageRow[]) {
  const direct = messages.find((message) => message.role === "agent" && message.run_id === group.firstRun.id);
  if (direct) return direct.id;
  const fallback = messages.find(
    (message) => message.role === "agent" && message.created_at >= group.firstRun.dispatch_at,
  );
  return fallback?.id ?? null;
}
