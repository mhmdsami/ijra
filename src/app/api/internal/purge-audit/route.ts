import { NextResponse } from "next/server";
import { purgeAuditEvents } from "@/db";
import { env } from "@/env";
import { AUDIT_RETENTION_DAYS, auditCutoff } from "@/lib/audit-retention";
import { verifySignature } from "@/lib/signature";

export async function POST(req: Request) {
  const secret = env().AUDIT_PURGE_KEY;
  if (!secret) return NextResponse.json({ error: "audit purge is not configured" }, { status: 500 });

  const body = await req.text();
  const fresh = await verifySignature(
    body,
    req.headers.get("x-ijra-timestamp") ?? "",
    req.headers.get("x-ijra-signature") ?? "",
    secret,
  );
  if (!fresh) return NextResponse.json({ error: "invalid purge signature" }, { status: 401 });

  const deleted = await purgeAuditEvents(auditCutoff());
  return NextResponse.json({ ok: true, deleted, retentionDays: AUDIT_RETENTION_DAYS });
}
