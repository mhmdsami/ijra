import { NextResponse } from "next/server";
import { appendAuditEvent, decideRun, getRun, getRuns } from "@/db";
import { requireSameOrigin } from "@/lib/csrf";
import { projectConfig } from "@/lib/projects";
import { inspectPull, mergePull } from "@/lib/runner";
import { canReviewRun } from "@/lib/access";
import { requireUser } from "@/lib/user";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try { requireSameOrigin(req); } catch { return NextResponse.json({ error: "cross-origin request blocked" }, { status: 403 }); }
  const user = await requireUser();
  if (!canReviewRun(user)) return NextResponse.json({ error: "only admins can merge" }, { status: 403 });

  const run = await getRun(id);
  if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (run.status !== "awaiting_review") return NextResponse.json({ error: "run is not awaiting review" }, { status: 409 });
  if (!run.pr_url) return NextResponse.json({ error: "run has no pull request" }, { status: 409 });

  const repo = projectConfig(run.project).repo;
  let review;
  try {
    review = await inspectPull(repo, run.pr_url, run.policy_status);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "could not read the pull request" }, { status: 502 });
  }
  if (!review.ok || review.number === null || !review.sha) {
    await appendAuditEvent({
      sessionId: run.session_id,
      runId: run.id,
      actorId: user.id,
      action: "run.merge_blocked",
      metadata: { reasons: review.reasons },
    });
    return NextResponse.json({ error: review.reasons.join("; ") }, { status: 409 });
  }

  try {
    await mergePull(repo, review.number, review.sha);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "GitHub refused the merge" }, { status: 502 });
  }

  await decideRun({
    id: run.id,
    from: ["awaiting_review"],
    status: "merged",
    decision: "approved",
    actorId: user.id,
    action: "run.merged",
    metadata: { pr: run.pr_url },
  });
  return NextResponse.json({ runs: await getRuns(run.session_id) });
}
