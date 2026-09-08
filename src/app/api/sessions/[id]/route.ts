import { NextResponse } from "next/server";
import { requireSameOrigin } from "@/lib/csrf";
import { addMessage, deleteSession, getMessages, getRuns, getSession, updateRun } from "@/db";
import { syncRun } from "@/lib/runner";
import { requireUser, canAccessSession } from "@/lib/user";
import { appendAuditEvent } from "@/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const session = await getSession(id);
  if (!session || !canAccessSession(user, session)) return NextResponse.json({ error: "not found" }, { status: 404 });

  const runs = await getRuns(id);
  const terminal = new Set(["done", "merged", "failed", "cancelled", "answered", "no_changes", "awaiting_review"]);
  let agentMessage: string | null = null;

  for (const run of runs) {
    if (terminal.has(run.status) || run.agent_msg) continue;
    const result = await syncRun({
      id: run.id,
      project: run.project,
      session: session.id,
      status: run.status,
      mode: run.mode,
      ghRunId: run.gh_run_id,
      dispatchAt: run.dispatch_at,
    });
    if (terminal.has(result.status)) {
      agentMessage = renderAgentMessage(result);
      await updateRun(run.id, { agent_msg: 1 });
    }
  }

  if (agentMessage) await addMessage(id, "agent", agentMessage);

  return NextResponse.json({
    session,
    messages: await getMessages(id),
    runs: await getRuns(id),
  });
}

function renderAgentMessage(result: {
  status: string;
  prUrl?: string | null;
  runUrl?: string | null;
  agentSummary: string | null;
}) {
  if (result.status === "failed") {
    return `Something went wrong running this request.${result.runUrl ? `\n\nActions log: ${result.runUrl}` : ""}`;
  }
  if (!result.prUrl) return "Request completed with no changes needed.";
  const link = result.status === "merged" ? "Merged" : "Pull request is ready";
  return `${link}: ${result.prUrl}${result.agentSummary ? `\n\n${result.agentSummary}` : ""}`;
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
