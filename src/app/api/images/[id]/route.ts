import { getImage, getSession } from "@/db";
import { env } from "@/env";
import { verifyImageSignature } from "@/lib/images";
import { canAccessSession, requireUser } from "@/lib/user";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const image = await getImage(id);
  if (!image) return new Response("not found", { status: 404 });

  const url = new URL(req.url);
  const exp = url.searchParams.get("exp") ?? "";
  const sig = url.searchParams.get("sig") ?? "";
  const signed = exp && sig && (await verifyImageSignature(id, exp, sig, env().IJRA_RUNNER_KEY));
  if (!signed) {
    const user = await requireUser();
    const session = await getSession(image.session_id);
    if (!session || !canAccessSession(user, session)) return new Response("not found", { status: 404 });
  }

  const bytes = image.bytes instanceof ArrayBuffer ? new Uint8Array(image.bytes) : new Uint8Array(image.bytes);
  return new Response(bytes, {
    headers: {
      "content-type": image.mime,
      "content-length": String(bytes.byteLength),
      "cache-control": signed ? "private, no-store" : "private, max-age=300",
    },
  });
}
