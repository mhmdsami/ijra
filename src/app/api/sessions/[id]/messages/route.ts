import { NextResponse } from "next/server";
import { requireSameOrigin } from "@/lib/csrf";
import {
  DEFAULT_DAILY_LIMIT,
  countSessionImages,
  setImagesRun,
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
import { MAX_IMAGES_PER_MESSAGE, signImage } from "@/lib/images";
import { env } from "@/env";
import { titleFrom } from "@/lib/title";
import { canAccessSession, canWriteProject, requireUser } from "@/lib/user";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { content?: string; model?: string; imageIds?: string[] } | null;
  if (!body) return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  const { content, model } = body;
  if (!content?.trim()) return NextResponse.json({ error: "content is required" }, { status: 400 });
  const imageIds = Array.isArray(body.imageIds) ? body.imageIds.filter((value): value is string => typeof value === "string") : [];
  if (imageIds.length > MAX_IMAGES_PER_MESSAGE) {
    return NextResponse.json({ error: `at most ${MAX_IMAGES_PER_MESSAGE} images per message` }, { status: 400 });
  }

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
  const modelRow = await getModel(runModel);
  if (!modelRow) {
    return NextResponse.json({ error: "unknown model" }, { status: 400 });
  }
  if (imageIds.length > 0) {
    if (modelRow.vision !== 1) return NextResponse.json({ error: "this model does not accept images" }, { status: 400 });
    if ((await countSessionImages(id, imageIds)) !== imageIds.length) {
      return NextResponse.json({ error: "unknown image" }, { status: 400 });
    }
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

  await addMessage(id, "user", request, imageIds.length > 0 ? { imageIds } : undefined);
  await touchSessionTitle(id, titleFrom(request));
  await appendAuditEvent({
    sessionId: id,
    runId,
    actorId: user.id,
    action: "run.requested",
    metadata: { project: session.project, model: runModel },
  });
  const imageUrls: string[] = [];
  if (imageIds.length > 0) {
    await setImagesRun(imageIds, runId);
    const origin = new URL(req.url).origin;
    for (const imageId of imageIds) {
      const { exp, sig } = await signImage(imageId, env().IJRA_RUNNER_KEY);
      imageUrls.push(`${origin}/api/images/${imageId}?exp=${exp}&sig=${sig}`);
    }
  }

  try {
    await startRun({ project: session.project, request, session: id, model: runModel, mode, runId, imageUrls });
  } catch (e) {
    await updateRun(runId, { status: "failed" });
    await appendAuditEvent({ sessionId: id, runId, actorId: user.id, action: "run.dispatch_failed", metadata: { error: e instanceof Error ? e.message : String(e) } });
    return NextResponse.json({ error: "dispatch failed" }, { status: 502 });
  }

  return NextResponse.json({ messages: await getMessages(id), runs: await getRuns(id) });
}
