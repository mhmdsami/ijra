import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth-server";

let handlers: ReturnType<typeof toNextJsHandler> | null = null;

function h() {
  handlers ??= toNextJsHandler(auth().handler);
  return handlers;
}

export function GET(req: Request) {
  return h().GET(req);
}

export function POST(req: Request) {
  return h().POST(req);
}
