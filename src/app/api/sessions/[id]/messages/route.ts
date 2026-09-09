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
import { projectConfig, MODELS } from "@/lib/projects";
import { startRun } from "@/lib/runner";
import { canAccessSession, canWriteProject, requireUser } from "@/lib/user";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { content, model } = (await req.json()) as { content?: string; model?: string };
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

  const cfg = projectConfig(session.project);
  const request = content.trim();
  const runModel = model?.trim() || cfg.defaultModel;
  if (!(MODELS as readonly string[]).includes(runModel)) {
    return NextResponse.json({ error: "unknown model" }, { status: 400 });
  }
  if (!user.isAdmin) {
    const limit = (await getUserLimit(user.id)) ?? DEFAULT_DAILY_LIMIT;
    const used = await countRunsForUserSince(user.id, dayStart.getTime());
    if (used >= limit) {
      return NextResponse.json({ error: `daily limit reached (${used} of ${limit} requests today)` }, { status: 429 });
    }
  }
  const mode = canWriteProject(user, session.project) ? "auto" : "ask";
  const runId = await createRun(id, session.project, request, runModel, user.id, dayStart.getTime(), mode);
  if (!runId) return NextResponse.json({ error: "request or project limit reached" }, { status: 409 });

  await addMessage(id, "user", request);
  await touchSessionTitle(id, request.split("\n")[0].slice(0, 80));
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
