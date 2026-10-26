import { NextResponse } from "next/server";
import { addMessage, findRunByBranch, setRunStatus } from "@/db";
import { env } from "@/env";
import { validGithubSignature } from "@/lib/github-signature";
import { projectForRepo } from "@/lib/projects";
import { pullEventFrom, pullStatusMessage } from "@/lib/runner/pull-sync";

export async function POST(req: Request) {
  const body = await req.text();
  const secret = env().GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    console.error("GITHUB_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "webhook not configured" }, { status: 500 });
  }
  if (!(await validGithubSignature(body, req.headers.get("x-hub-signature-256") ?? "", secret))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  if (req.headers.get("x-github-event") === "ping") return NextResponse.json({ ok: true });

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const event = pullEventFrom(payload, req.headers.get("x-github-delivery"));
  if (!event) return NextResponse.json({ ok: true, ignored: true }, { status: 202 });

  const project = projectForRepo(event.repo);
  if (!project) return NextResponse.json({ ok: true, ignored: true }, { status: 202 });

  const run = await findRunByBranch(project.id, event.branch);
  if (!run) return NextResponse.json({ ok: true, ignored: true }, { status: 202 });

  const to = event.action === "reopened" ? "awaiting_review" : event.merged ? "merged" : "closed";
  const from = event.action === "reopened" ? ["closed"] : event.merged ? ["awaiting_review", "rejected"] : ["awaiting_review"];
  const changed = await setRunStatus({
    id: run.id,
    from,
    to,
    action: to === "awaiting_review" ? "run.reopened" : `run.${to}`,
    prUrl: event.prUrl,
    branch: event.branch,
    metadata: { source: "github", delivery: event.delivery },
  });
  if (changed && (to === "merged" || to === "closed")) {
    await addMessage(run.session_id, "agent", pullStatusMessage(to, event.prUrl));
  }
  console.log(`github webhook ${event.action} ${event.repo} ${event.branch}: ${changed ? to : "no change"}`);
  return NextResponse.json({ ok: true, changed });
}
