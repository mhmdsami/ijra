import { NextResponse } from "next/server";
import { requireSameOrigin } from "@/lib/csrf";
import { addMessage, deleteSession, getMessages, getRuns, getSession, touchRun, updateRun } from "@/db";
import { syncRun } from "@/lib/runner";
import { pullStatusMessage, shouldSyncRun } from "@/lib/runner/pull-sync";
import { requireUser, canAccessSession } from "@/lib/user";
import { appendAuditEvent } from "@/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const session = await getSession(id);
  if (!session || !canAccessSession(user, session)) return NextResponse.json({ error: "not found" }, { status: 404 });

  const runs = await getRuns(id);
  const messageStatuses = new Set(["done", "merged", "closed", "failed", "cancelled", "answered", "no_changes", "awaiting_review", "blocked"]);
  let agentMessage: string | null = null;

  for (const run of runs) {
    if (!shouldSyncRun(run)) continue;
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
    if (run.status === "awaiting_review" && result.status === "awaiting_review") await touchRun(run.id);
    if (result.changed && messageStatuses.has(result.status) && (result.status === "merged" || result.status === "closed" || !run.agent_msg)) {
      agentMessage = renderAgentMessage(result);
      await updateRun(run.id, { agent_msg: 1 });
    }
  }

  if (agentMessage) await addMessage(id, "agent", agentMessage);

  const finalRuns = await getRuns(id);
  return NextResponse.json({
    session,
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
    return pullStatusMessage(result.status, result.prUrl);
  }
  if (!result.prUrl) return "Request completed with no changes needed.";
  return `Pull request is ready: ${result.prUrl}${result.agentSummary ? `\n\n${result.agentSummary}` : ""}`;
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try { requireSameOrigin(_req); } catch { return NextResponse.json({ error: "cross-origin request blocked" }, { status: 403 }); }
  const user = await requireUser();
  const session = await getSession(id);
  if (!session || !canAccessSession(user, session)) return NextResponse.json({ error: "not found" }, { status: 404 });
  await appendAuditEvent({ sessionId: id, actorId: user.id, action: "session.deleted", metadata: { project: session.project } });
  await deleteSession(id);
  return NextResponse.json({ ok: true });
}
