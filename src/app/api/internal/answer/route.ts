import { NextResponse } from "next/server";
import {
  addMessage,
  appendAuditEvent,
  claimRunMessage,
  clearProgress,
  getRun,
  setGeneratedTitle,
  updateRun,
} from "@/db";
import { env } from "@/env";
import { PRUNE_CALLBACKS_SQL, RECORD_CALLBACK_SQL, REPLAY_TTL_MS } from "@/lib/runner/replay";
import { acceptsReport, parseRunnerReport, reportFingerprint, reportMessage, reportStatus } from "@/lib/runner/report";
import { parseUsage } from "@/lib/runner/usage";
import { validSignature } from "@/lib/webhook";

function parseJson(body: string) {
  try {
    return JSON.parse(body) ?? {};
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const body = await req.text();
  if (
    !(await validSignature(body, req.headers.get("x-ijra-timestamp") ?? "", req.headers.get("x-ijra-signature") ?? ""))
  ) {
    return NextResponse.json({ error: "invalid runner signature" }, { status: 401 });
  }
  const parsed = parseJson(body);
  if (!parsed) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const payload = parseRunnerReport(parsed);
  if (!payload) return NextResponse.json({ error: "runId and status are required" }, { status: 400 });
  const fingerprint = await reportFingerprint(req.headers.get("x-ijra-timestamp") ?? "", body);
  const replay = await env().DB.prepare(RECORD_CALLBACK_SQL).bind(fingerprint, payload.runId, Date.now()).run();
  if (replay.meta.changes !== 1) return NextResponse.json({ ok: true });
  await env()
    .DB.prepare(PRUNE_CALLBACKS_SQL)
    .bind(Date.now() - REPLAY_TTL_MS)
    .run();
  const run = await getRun(payload.runId);
  if (!run) return NextResponse.json({ error: "unknown run" }, { status: 404 });
  if (!acceptsReport(run.status)) return NextResponse.json({ error: "invalid run transition" }, { status: 409 });

  const status = reportStatus(payload.status);
  const { visible, errorDetail } = reportMessage({ status, summary: payload.summary, error: payload.outcome?.error });
  const usage = parseUsage(payload.outcome?.usage);
  await updateRun(run.id, {
    status,
    pr_url: payload.outcome?.prUrl ?? null,
    branch: payload.outcome?.branch ?? null,
    policy_status: payload.outcome?.policyReasons?.length ? "blocked" : "passed",
    policy_reasons: JSON.stringify(payload.outcome?.policyReasons ?? []),
    input_tokens: usage.input,
    output_tokens: usage.output,
    cache_read_tokens: usage.cacheRead,
    cache_write_tokens: usage.cacheWrite,
    cost_usd: usage.costUsd,
    model_calls: usage.modelCalls,
    error_detail: errorDetail,
  });
  if (visible && (await claimRunMessage(run.id))) await addMessage(run.session_id, "agent", visible, undefined, run.id);
  await clearProgress(run.id);
  const title = payload.outcome?.title?.trim();
  if (title) await setGeneratedTitle(run.session_id, title.slice(0, 80));
  await appendAuditEvent({
    sessionId: run.session_id,
    runId: run.id,
    action: "runner.reported",
    metadata: { status, policyReasons: payload.outcome?.policyReasons ?? [] },
  });
  return NextResponse.json({ ok: true });
}
