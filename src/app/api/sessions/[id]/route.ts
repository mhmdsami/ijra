import { NextResponse } from "next/server";
import { appendAuditEvent, deleteSession, getMessages, getRuns, getSession, renameSession } from "@/db";
import { requireSameOrigin } from "@/lib/csrf";
import { canAccessSession, requireUser } from "@/lib/user";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const session = await getSession(id);
  if (!session || !canAccessSession(user, session)) return NextResponse.json({ error: "not found" }, { status: 404 });

  const runs = await getRuns(id);
  return NextResponse.json({
    session,
    messages: await getMessages(id),
    runs: user.isAdmin ? runs : runs.map((run) => ({ ...run, error_detail: null })),
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    requireSameOrigin(req);
  } catch {
    return NextResponse.json({ error: "cross-origin request blocked" }, { status: 403 });
  }
  const user = await requireUser();
  const session = await getSession(id);
  if (!session || !canAccessSession(user, session)) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { title?: unknown } | null;
  const title = typeof body?.title === "string" ? body.title.trim().replace(/\s+/g, " ") : "";
  if (!title || title.length > 80)
    return NextResponse.json({ error: "title must be 1 to 80 characters" }, { status: 400 });

  await renameSession(id, title);
  await appendAuditEvent({ sessionId: id, actorId: user.id, action: "session.renamed", metadata: { title } });
  return NextResponse.json({ title });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    requireSameOrigin(_req);
  } catch {
    return NextResponse.json({ error: "cross-origin request blocked" }, { status: 403 });
  }
  const user = await requireUser();
  const session = await getSession(id);
  if (!session || !canAccessSession(user, session)) return NextResponse.json({ error: "not found" }, { status: 404 });
  await appendAuditEvent({
    sessionId: id,
    actorId: user.id,
    action: "session.deleted",
    metadata: { project: session.project },
  });
  await deleteSession(id);
  return NextResponse.json({ ok: true });
}
