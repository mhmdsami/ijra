import { NextResponse } from "next/server";
import { addImage, getSession } from "@/db";
import { requireSameOrigin } from "@/lib/csrf";
import { decodeBase64Image, imageMetaError, MAX_IMAGES_PER_SESSION, MAX_IMAGES_PER_USER_PER_DAY } from "@/lib/images";
import { canAccessSession, requireUser } from "@/lib/user";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    requireSameOrigin(req);
  } catch {
    return NextResponse.json({ error: "cross-origin request blocked" }, { status: 403 });
  }
  const user = await requireUser();
  const session = await getSession(id);
  if (!session || !canAccessSession(user, session)) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as {
    mime?: string;
    width?: number;
    height?: number;
    data?: string;
  } | null;
  if (!body?.mime || !body.data) return NextResponse.json({ error: "mime and data are required" }, { status: 400 });

  const bytes = decodeBase64Image(body.data);
  if (!bytes) return NextResponse.json({ error: "data must be base64" }, { status: 400 });
  const invalid = imageMetaError(body.mime, bytes);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 413 });

  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const image = await addImage({
    sessionId: id,
    ownerId: session.owner_id ?? user.id,
    mime: body.mime,
    width: Number.isInteger(body.width) ? (body.width as number) : null,
    height: Number.isInteger(body.height) ? (body.height as number) : null,
    bytes,
    dayStart: dayStart.getTime(),
  });
  if ("error" in image) {
    return NextResponse.json(
      {
        error:
          image.error === "session"
            ? `this session has reached its image limit (${MAX_IMAGES_PER_SESSION})`
            : `image upload limit reached (${MAX_IMAGES_PER_USER_PER_DAY} per day)`,
      },
      { status: 429 },
    );
  }
  return NextResponse.json({ id: image.id });
}
