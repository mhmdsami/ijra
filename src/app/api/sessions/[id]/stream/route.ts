import { getRuns, getSession, listProgress } from "@/db";
import { canAccessSession, requireUser } from "@/lib/user";
import type { StreamEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

const ACTIVE = new Set(["dispatching", "running"]);
const MAX_STREAM_MS = 4.5 * 60_000;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const session = await getSession(id);
  if (!session || !canAccessSession(user, session)) return new Response("not found", { status: 404 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event: StreamEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          closed = true;
        }
      };
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
        }
      };
      req.signal.addEventListener("abort", close);

      const started = Date.now();
      let cursor = 0;
      try {
        while (!closed) {
          const active = (await getRuns(id)).find((run) => ACTIVE.has(run.status));
          if (!active) {
            send({ type: "done" });
            break;
          }
          const rows = await listProgress(active.id, cursor);
          for (const row of rows) {
            cursor = row.id;
            send({ type: row.kind, text: row.text });
          }
          if (Date.now() - started > MAX_STREAM_MS) {
            send({ type: "reconnect" });
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch {
      } finally {
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
