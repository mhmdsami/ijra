import { NextResponse } from "next/server";
import { requireSameOrigin } from "@/lib/csrf";
import { addImage, getSession } from "@/db";
import { canAccessSession, requireUser } from "@/lib/user";
import { decodeBase64Image, imageMetaError } from "@/lib/images";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try { requireSameOrigin(req); } catch { return NextResponse.json({ error: "cross-origin request blocked" }, { status: 403 }); }
  const user = await requireUser();
  const session = await getSession(id);
  if (!session || !canAccessSession(user, session)) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { mime?: string; width?: number; height?: number; data?: string } | null;
  if (!body?.mime || !body.data) return NextResponse.json({ error: "mime and data are required" }, { status: 400 });

  const bytes = decodeBase64Image(body.data);
  if (!bytes) return NextResponse.json({ error: "data must be base64" }, { status: 400 });
  const invalid = imageMetaError(body.mime, bytes);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 413 });

  const imageId = await addImage({
    sessionId: id,
    mime: body.mime,
    width: Number.isInteger(body.width) ? (body.width as number) : null,
    height: Number.isInteger(body.height) ? (body.height as number) : null,
    bytes,
  });
  return NextResponse.json({ id: imageId });
}
