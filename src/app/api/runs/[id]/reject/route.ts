import { NextResponse } from "next/server";
import { decideRun, getRun, getRuns } from "@/db";
import { requireSameOrigin } from "@/lib/csrf";
import { canReviewRun } from "@/lib/access";
import { requireUser } from "@/lib/user";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try { requireSameOrigin(req); } catch { return NextResponse.json({ error: "cross-origin request blocked" }, { status: 403 }); }
  const user = await requireUser();
  if (!canReviewRun(user)) return NextResponse.json({ error: "only admins can reject" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { reason?: string } | null;
  const reason = body?.reason?.trim();
  if (!reason) return NextResponse.json({ error: "a rejection reason is required" }, { status: 400 });
  if (reason.length > 500) return NextResponse.json({ error: "the reason is too long" }, { status: 400 });

  const run = await getRun(id);
  if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });

  const updated = await decideRun({
    id: run.id,
    from: ["awaiting_review"],
    status: "rejected",
    decision: "rejected",
    actorId: user.id,
    reason,
    action: "run.rejected",
  });
  if (!updated) return NextResponse.json({ error: "run is not awaiting review" }, { status: 409 });
  return NextResponse.json({ runs: await getRuns(run.session_id) });
}
