import { NextResponse } from "next/server";
import { addMessage, claimRunMessage, getMessages, getRuns, getSession, touchRun } from "@/db";
import { requireSameOrigin } from "@/lib/csrf";
import { syncRun } from "@/lib/runner";
import { shouldSyncRun } from "@/lib/runner/pull-sync";
import { canAccessSession, requireUser } from "@/lib/user";

const MESSAGE_STATUSES = new Set([
  "done",
  "merged",
  "closed",
  "failed",
  "cancelled",
  "answered",
  "no_changes",
  "awaiting_review",
  "blocked",
]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    requireSameOrigin(req);
  } catch {
    return NextResponse.json({ error: "cross-origin request blocked" }, { status: 403 });
  }
  const user = await requireUser();
  const session = await getSession(id);
  if (!session || !canAccessSession(user, session)) return NextResponse.json({ error: "not found" }, { status: 404 });

  const runs = await getRuns(id);
  const agentMessages: { text: string; runId: string }[] = [];
  let synced = 0;

  for (const run of runs) {
    if (synced >= 5) break;
    if (!shouldSyncRun(run)) continue;
    synced += 1;
    const result = await syncRun({
      id: run.id,
      project: run.project,
      session: session.id,
      status: run.status,
      mode: run.mode,
      ghRunId: run.gh_run_id,
      dispatchAt: run.dispatch_at,
      branch: run.branch,
    });
    await touchRun(run.id);
    if (result.changed && MESSAGE_STATUSES.has(result.status)) {
      if (await claimRunMessage(run.id)) agentMessages.push({ text: renderAgentMessage(result), runId: run.id });
    }
  }

  for (const message of agentMessages) await addMessage(id, "agent", message.text, undefined, message.runId);
  const finalRuns = await getRuns(id);
  return NextResponse.json({
    messages: await getMessages(id),
    runs: user.isAdmin ? finalRuns : finalRuns.map((run) => ({ ...run, error_detail: null })),
  });
}

function renderAgentMessage(result: {
  status: string;
  prUrl?: string | null;
  runUrl?: string | null;
  agentSummary: string | null;
}) {
  if (result.status === "cancelled") return "Request cancelled.";
  if (result.status === "failed") {
    return `Something went wrong running this request.${result.runUrl ? `\n\nActions log: ${result.runUrl}` : ""}`;
  }
  if ((result.status === "merged" || result.status === "closed") && result.prUrl) {
    return `${result.status === "merged" ? "Merged" : "Pull request closed without merging"}: ${result.prUrl}`;
  }
  if (!result.prUrl) return "Request completed with no changes needed.";
  return `Pull request is ready: ${result.prUrl}${result.agentSummary ? `\n\n${result.agentSummary}` : ""}`;
}
