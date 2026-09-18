import { NextResponse } from "next/server";
import { requireSameOrigin } from "@/lib/csrf";
import {
  DEFAULT_DAILY_LIMIT,
  addMessage,
  appendAuditEvent,
  countActiveRunsForProject,
  countRunsForUserSince,
  createRun,
  getMessages,
  getRuns,
  getSession,
  getUserLimit,
  touchSessionTitle,
  updateRun,
} from "@/db";
import { getDefaultModel, getModel } from "@/db";
import { startRun } from "@/lib/runner";
import { titleFrom } from "@/lib/title";
import { canAccessSession, canWriteProject, requireUser } from "@/lib/user";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { content?: string; model?: string } | null;
  if (!body) return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  const { content, model } = body;
  if (!content?.trim()) return NextResponse.json({ error: "content is required" }, { status: 400 });

  try { requireSameOrigin(req); } catch { return NextResponse.json({ error: "cross-origin request blocked" }, { status: 403 }); }
  const user = await requireUser();
  const session = await getSession(id);
  if (!session || !canAccessSession(user, session)) return NextResponse.json({ error: "not found" }, { status: 404 });

  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  if ((await countActiveRunsForProject(session.project)) >= 1) {
    return NextResponse.json({ error: "a run is already active for this project" }, { status: 409 });
  }

  const request = content.trim();
  const runModel = model?.trim() || (await getDefaultModel()) || "";
  if (!(await getModel(runModel))) {
    return NextResponse.json({ error: "unknown model" }, { status: 400 });
  }
  let limit: number | null = null;
  if (!user.isAdmin) {
    limit = (await getUserLimit(user.id)) ?? DEFAULT_DAILY_LIMIT;
    const used = await countRunsForUserSince(user.id, dayStart.getTime());
    if (used >= limit) {
      return NextResponse.json({ error: `daily limit reached (${used} of ${limit} requests today)` }, { status: 429 });
    }
  }
  const mode = canWriteProject(user, session.project) ? "auto" : "ask";
  const runId = await createRun(id, session.project, request, runModel, user.id, dayStart.getTime(), limit, mode);
  if (!runId) {
    const active = await countActiveRunsForProject(session.project);
    return NextResponse.json({ error: active >= 1 ? "a run is already active for this project" : "daily limit reached" }, { status: 409 });
  }

  await addMessage(id, "user", request);
  await touchSessionTitle(id, titleFrom(request));
  await appendAuditEvent({
    sessionId: id,
    runId,
    actorId: user.id,
    action: "run.requested",
    metadata: { project: session.project, model: runModel },
  });
  try {
    await startRun({ project: session.project, request, session: id, model: runModel, mode, runId });
  } catch (e) {
    await updateRun(runId, { status: "failed" });
    await appendAuditEvent({ sessionId: id, runId, actorId: user.id, action: "run.dispatch_failed", metadata: { error: e instanceof Error ? e.message : String(e) } });
    return NextResponse.json({ error: "dispatch failed" }, { status: 502 });
  }

  return NextResponse.json({ messages: await getMessages(id), runs: await getRuns(id) });
}
