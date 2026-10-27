import { NextResponse } from "next/server";
import { appendAuditEvent, createSession, listSessionsForUser } from "@/db";
import { requireSameOrigin } from "@/lib/csrf";
import { projects } from "@/lib/projects";
import { SESSIONS_PER_DAY } from "@/lib/session-quota";
import { canAccessProject, requireUser } from "@/lib/user";

export async function GET(req: Request) {
  const user = await requireUser();
  const params = new URL(req.url).searchParams;
  const limit = Number.parseInt(params.get("limit") ?? "", 10);
  const offset = Number.parseInt(params.get("offset") ?? "", 10);
  const query = params.get("q") ?? "";
  return NextResponse.json(
    await listSessionsForUser(user.id, user.allowedProjects, {
      limit: Number.isFinite(limit) ? limit : undefined,
      offset: Number.isFinite(offset) ? offset : undefined,
      query,
    }),
  );
}

export async function POST(req: Request) {
  try {
    requireSameOrigin(req);
  } catch {
    return NextResponse.json({ error: "cross-origin request blocked" }, { status: 403 });
  }
  const user = await requireUser();
  const { project } = ((await req.json().catch(() => null)) as { project?: string } | null) ?? {};
  const known = projects().map((p) => p.id);
  if (!project || !known.includes(project)) {
    return NextResponse.json({ error: `project must be one of: ${known.join(", ")}` }, { status: 400 });
  }
  if (!canAccessProject(user, project)) {
    return NextResponse.json({ error: "no access to this project" }, { status: 403 });
  }
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const id = await createSession(project, user.id, dayStart.getTime());
  if (!id) {
    return NextResponse.json({ error: `daily thread limit reached (${SESSIONS_PER_DAY})` }, { status: 429 });
  }
  await appendAuditEvent({ sessionId: id, actorId: user.id, action: "session.created", metadata: { project } });
  return NextResponse.json({ id });
}
