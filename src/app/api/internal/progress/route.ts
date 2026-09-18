import { NextResponse } from "next/server";
import { appendProgress, getRun } from "@/db";
import { redactText, validSignature } from "@/lib/webhook";

const KINDS = new Set(["stage", "text", "tool"]);

export async function POST(req: Request) {
  const body = await req.text();
  if (!(await validSignature(body, req.headers.get("x-ijra-timestamp") ?? "", req.headers.get("x-ijra-signature") ?? ""))) {
    return NextResponse.json({ error: "invalid runner signature" }, { status: 401 });
  }

  let payload: { runId?: string; events?: unknown };
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (!payload?.runId) return NextResponse.json({ error: "runId is required" }, { status: 400 });
  const run = await getRun(payload.runId);
  if (!run) return NextResponse.json({ error: "unknown run" }, { status: 404 });
  if (!["dispatching", "running"].includes(run.status)) return NextResponse.json({ ok: true });

  const events = Array.isArray(payload.events) ? payload.events.slice(0, 200) : [];
  const clean = events.flatMap((raw) => {
    const event = raw as { seq?: unknown; kind?: unknown; text?: unknown };
    if (typeof event?.seq !== "number" || !Number.isInteger(event.seq)) return [];
    if (typeof event.kind !== "string" || !KINDS.has(event.kind)) return [];
    if (typeof event.text !== "string" || event.text.length === 0) return [];
    return [{ seq: event.seq, kind: event.kind as "stage" | "text" | "tool", text: redactText(event.text).slice(0, 4000) }];
  });

  await appendProgress(run.id, clean);
  return NextResponse.json({ ok: true });
}
