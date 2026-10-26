import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { appendAuditEvent, createRun, getModel, getRun, getRuns, getSession, updateRun } from "@/db";
import { requireSameOrigin } from "@/lib/csrf";
import { startRun } from "@/lib/runner";
import { canRetry } from "@/lib/runner/transitions";
import { canReviewRun } from "@/lib/access";
import { requireUser } from "@/lib/user";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try { requireSameOrigin(req); } catch { return NextResponse.json({ error: "cross-origin request blocked" }, { status: 403 }); }
  const user = await requireUser();
  if (!canReviewRun(user)) return NextResponse.json({ error: "only admins can retry" }, { status: 403 });

  const run = await getRun(id);
  if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!canRetry(run.status)) return NextResponse.json({ error: "this run cannot be retried" }, { status: 409 });
  const session = await getSession(run.session_id);
  if (!session) return NextResponse.json({ error: "the session no longer exists" }, { status: 404 });
  if (!(await getModel(run.model))) return NextResponse.json({ error: "the model for this run is no longer available" }, { status: 409 });

  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const newId = await createRun(
    session.id,
    run.project,
    run.request,
    run.model,
    run.requested_by ?? user.id,
    dayStart.getTime(),
    null,
    run.mode
  );
  if (!newId) return NextResponse.json({ error: "a run is already active for this project" }, { status: 409 });
  await updateRun(newId, { parent_run_id: run.id });
  await appendAuditEvent({
    sessionId: session.id,
    runId: newId,
    actorId: user.id,
    action: "run.retried",
    metadata: { sourceRunId: run.id },
  });

  const dispatch = async () => {
    try {
      await startRun({
        project: run.project,
        request: run.request,
        session: session.id,
        model: run.model,
        mode: run.mode,
        runId: newId,
      });
    } catch (e) {
      await updateRun(newId, { status: "failed" });
      await appendAuditEvent({
        sessionId: session.id,
        runId: newId,
        actorId: user.id,
        action: "run.dispatch_failed",
        metadata: { error: e instanceof Error ? e.message : String(e) },
      });
    }
  };
  try {
    getCloudflareContext().ctx.waitUntil(dispatch());
  } catch {
    await dispatch();
  }

  return NextResponse.json({ runs: await getRuns(session.id) });
}
