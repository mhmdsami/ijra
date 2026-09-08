"use client";

import { MessageSquarePlus, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { SessionRowWithStatus } from "@/db";
import { cn } from "@/lib/utils";

export function ThreadsSidebar({ sessions }: { sessions: SessionRowWithStatus[] }) {
  const [open, setOpen] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    if (localStorage.getItem("ijra-sidebar") === "0") setOpen(false);
  }, []);

  function toggle() {
    setOpen((v) => {
      localStorage.setItem("ijra-sidebar", v ? "0" : "1");
      return !v;
    });
  }

  if (!open) {
    return (
      <div className="hidden shrink-0 border-r md:flex md:flex-col md:items-center">
        <button onClick={toggle} className="m-2 rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Show threads">
          <PanelLeftOpen className="size-4" />
        </button>
        <Link href="/" className="rounded-lg p-2 text-primary hover:bg-secondary" aria-label="New thread">
          <MessageSquarePlus className="size-4" />
        </Link>
      </div>
    );
  }

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r md:flex">
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-3">
        <span className="text-xs text-muted-foreground">Threads</span>
        <div className="flex items-center gap-0.5">
          <Link href="/" className="rounded-lg p-1.5 text-primary hover:bg-secondary" aria-label="New thread">
            <MessageSquarePlus className="size-4" />
          </Link>
          <button onClick={toggle} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Hide threads">
            <PanelLeftClose className="size-4" />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {sessions.length === 0 ? (
          <p className="px-2 py-3 text-xs leading-5 text-muted-foreground">Your requests will appear here.</p>
        ) : (
          <ul>
            {sessions.map((session) => (
              <li key={session.id}>
                <Link
                  href={`/s/${session.id}`}
                  className={cn(
                    "animate-fade-up block rounded-lg px-2 py-2.5 transition-colors hover:bg-secondary",
                    pathname === `/s/${session.id}` && "bg-secondary"
                  )}
                >
                  <div className="truncate text-xs text-foreground">{session.title || "Untitled request"}</div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="truncate text-[10px] text-muted-foreground">{session.project}</span>
                    <StatusBadge status={session.last_status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const label = !status ? "new" : status === "dispatching" || status === "running" ? "running" : status;
  return <Badge variant="outline" className="h-4 border-foreground/15 px-1 text-[9px] text-muted-foreground">{label}</Badge>;
}
