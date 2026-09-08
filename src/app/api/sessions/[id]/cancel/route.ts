import { NextResponse } from "next/server";
import { requireSameOrigin } from "@/lib/csrf";
import { appendAuditEvent, getRuns, getSession, updateRun } from "@/db";
import { cancelRun } from "@/lib/runner";
import { canAccessSession, requireUser } from "@/lib/user";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try { requireSameOrigin(_req); } catch { return NextResponse.json({ error: "cross-origin request blocked" }, { status: 403 }); }
  const user = await requireUser();
  if (!user.isAdmin) return NextResponse.json({ error: "admin access required" }, { status: 403 });
  const session = await getSession(id);
  if (!session || !canAccessSession(user, session)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const run = (await getRuns(id)).find((r) => r.status === "dispatching" || r.status === "running");
  if (!run) return NextResponse.json({ error: "no active run" }, { status: 409 });
  await cancelRun({ ghRunId: run.gh_run_id });
  await updateRun(run.id, { status: "cancelled" });
  await appendAuditEvent({ sessionId: id, runId: run.id, actorId: user.id, action: "run.cancelled" });
  return NextResponse.json({ runs: await getRuns(id) });
}
