import { NextResponse } from "next/server";
import { requireSameOrigin } from "@/lib/csrf";
import { appendAuditEvent, createSession } from "@/db";
import { canAccessProject, requireUser } from "@/lib/user";
import { projects } from "@/lib/projects";

export async function POST(req: Request) {
  try { requireSameOrigin(req); } catch { return NextResponse.json({ error: "cross-origin request blocked" }, { status: 403 }); }
  const user = await requireUser();
  const { project } = (await req.json()) as { project?: string };
  const known = projects().map((p) => p.id);
  if (!project || !known.includes(project)) {
    return NextResponse.json({ error: `project must be one of: ${known.join(", ")}` }, { status: 400 });
  }
  if (!canAccessProject(user, project)) {
    return NextResponse.json({ error: "no access to this project" }, { status: 403 });
  }
  const id = await createSession(project, user.id);
  await appendAuditEvent({ sessionId: id, actorId: user.id, action: "session.created", metadata: { project } });
  return NextResponse.json({ id });
}

export async function GET() {
  return NextResponse.json({ projects: projects().map((p) => p.id) });
}
