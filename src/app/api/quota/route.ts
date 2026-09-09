import { NextResponse } from "next/server";
import { DEFAULT_DAILY_LIMIT, countRunsForUserSince, getUserLimit } from "@/db";
import { requireUser } from "@/lib/user";

export async function GET() {
  const user = await requireUser();
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  if (user.isAdmin) return NextResponse.json({ used: 0, limit: null });
  const limit = (await getUserLimit(user.id)) ?? DEFAULT_DAILY_LIMIT;
  const used = await countRunsForUserSince(user.id, dayStart.getTime());
  return NextResponse.json({ used, limit });
}
