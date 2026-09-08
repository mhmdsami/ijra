import { NextResponse } from "next/server";
import { appendAuditEvent, getRuns, getSession, getRun, recordRunDecision, updateRun } from "@/db";
import { canAccessSession, requireUser } from "@/lib/user";
import { projectConfig } from "@/lib/projects";
import { mergeRun } from "@/lib/runner";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const session = await getSession(id);
  if (!session || !canAccessSession(user, session)) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!(user.isAdmin || session.owner_id === user.id)) return NextResponse.json({ error: "only the session owner can merge" }, { status: 403 });

  const run = (await getRuns(id)).find((r) => r.pr_url && r.status === "awaiting_review");
  if (!run || !run.pr_url) return NextResponse.json({ error: "no pull request awaiting review" }, { status: 409 });

  try {
    await mergeRun({ repo: projectConfig(session.project).repo, prUrl: run.pr_url });
  } catch (e) {
    await appendAuditEvent({ sessionId: id, runId: run.id, actorId: user.id, action: "run.merge_failed", metadata: { error: e instanceof Error ? e.message : String(e) } });
    return NextResponse.json({ error: "merge failed" }, { status: 502 });
  }

  const stored = await getRun(run.id);
  await updateRun(run.id, { status: "merged" });
  if (stored && !stored.decision) await recordRunDecision({ id: run.id, decision: "approved", actorId: user.id, reason: run.pr_url });
  await appendAuditEvent({ sessionId: id, runId: run.id, actorId: user.id, action: "run.merged", metadata: { prUrl: run.pr_url } });
  return NextResponse.json({ runs: await getRuns(id) });
}
