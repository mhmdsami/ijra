import { NextResponse } from "next/server";
import { addMessage, appendAuditEvent, getRun, updateRun } from "@/db";
import { env } from "@/env";

const maxAgeMs = 5 * 60_000;

async function validSignature(body: string, timestamp: string, signature: string) {
  if (!/^\d+$/.test(timestamp) || Math.abs(Date.now() - Number(timestamp)) > maxAgeMs) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env().IJRA_RUNNER_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`));
  const expected = [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  if (signature.length !== expected.length) return false;
  return [...signature].reduce((diff, char, index) => diff | (char.charCodeAt(0) ^ expected.charCodeAt(index)), 0) === 0;
}

export async function POST(req: Request) {
  const body = await req.text();
  if (!(await validSignature(body, req.headers.get("x-ijra-timestamp") ?? "", req.headers.get("x-ijra-signature") ?? ""))) {
    return NextResponse.json({ error: "invalid runner signature" }, { status: 401 });
  }
  const payload = JSON.parse(body) as { runId?: string; status?: string; summary?: string; outcome?: { prUrl?: string; branch?: string; policyReasons?: string[] } };
  if (!payload.runId || !payload.status) return NextResponse.json({ error: "runId and status are required" }, { status: 400 });
  const fingerprint = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${req.headers.get("x-ijra-timestamp")}.${body}`)))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const replay = await env().DB.prepare("INSERT OR IGNORE INTO runner_callbacks (fingerprint, run_id, received_at) VALUES (?, ?, ?)").bind(fingerprint, payload.runId, Date.now()).run();
  if (replay.meta.changes !== 1) return NextResponse.json({ ok: true });
  await env().DB.prepare("DELETE FROM runner_callbacks WHERE received_at < ?").bind(Date.now() - 24 * 60 * 60_000).run();
  const run = await getRun(payload.runId);
  if (!run) return NextResponse.json({ error: "unknown run" }, { status: 404 });
  if (!["dispatching", "running"].includes(run.status)) return NextResponse.json({ error: "invalid run transition" }, { status: 409 });
  const status = ["answered", "no_changes", "awaiting_review", "failed"].includes(payload.status) ? payload.status : "failed";
  const summary = payload.summary?.trim();
  await updateRun(run.id, { status, pr_url: payload.outcome?.prUrl ?? null, branch: payload.outcome?.branch ?? null, agent_msg: summary ? 1 : 0, policy_status: payload.outcome?.policyReasons?.length ? "blocked" : "passed", policy_reasons: JSON.stringify(payload.outcome?.policyReasons ?? []) });
  if (summary) await addMessage(run.session_id, "agent", summary);
  await appendAuditEvent({ sessionId: run.session_id, runId: run.id, action: "runner.reported", metadata: { status, policyReasons: payload.outcome?.policyReasons ?? [] } });
  return NextResponse.json({ ok: true });
}
