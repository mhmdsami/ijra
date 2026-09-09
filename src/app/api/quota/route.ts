import { NextResponse } from "next/server";
import { DEFAULT_DAILY_LIMIT, countRunsForUserModelSince, getUserLimit } from "@/db";
import { requireUser } from "@/lib/user";

export async function GET(req: Request) {
  const model = new URL(req.url).searchParams.get("model") ?? "";
  if (!model) return NextResponse.json({ error: "model is required" }, { status: 400 });
  const user = await requireUser();
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  if (user.isAdmin) return NextResponse.json({ used: 0, limit: null });
  const limit = (await getUserLimit(user.id, model)) ?? DEFAULT_DAILY_LIMIT;
  const used = await countRunsForUserModelSince(user.id, model, dayStart.getTime());
  return NextResponse.json({ used, limit });
}
