"use client";

import { Menu, MessageSquarePlus, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { SessionRowWithStatus } from "@/db";
import { cn } from "@/lib/utils";

function label(status: string | null) {
  if (!status) return "new";
  if (status === "dispatching" || status === "running") return "running";
  return status.replaceAll("_", " ");
}

export function MobileThreads({ sessions }: { sessions: SessionRowWithStatus[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="md:hidden">
      <button onClick={() => setOpen(true)} className="rounded-md px-2 py-1 text-[10px] text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Open threads">
        <Menu className="size-4" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50">
          <button className="absolute inset-0 bg-background/75 backdrop-blur-sm" onClick={() => setOpen(false)} aria-label="Close threads" />
          <aside className="relative flex h-full w-[min(19rem,86vw)] flex-col border-r bg-background shadow-2xl">
            <div className="flex h-14 items-center justify-between border-b px-4">
              <span className="text-xs text-muted-foreground">Threads</span>
              <div className="flex items-center gap-1">
                <Link href="/" onClick={() => setOpen(false)} className="rounded-md p-2 text-primary hover:bg-secondary" aria-label="New thread"><MessageSquarePlus className="size-4" /></Link>
                <button onClick={() => setOpen(false)} className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Close threads"><X className="size-4" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {sessions.length === 0 ? <p className="px-2 py-3 text-xs leading-5 text-muted-foreground">Your requests will appear here.</p> : <ul>{sessions.map((session) => <li key={session.id}><Link href={`/s/${session.id}`} onClick={() => setOpen(false)} className={cn("block rounded-lg px-2 py-2.5 hover:bg-secondary", pathname === `/s/${session.id}` && "bg-secondary")}><div className="truncate text-xs">{session.title || "Untitled request"}</div><div className="mt-1 flex items-center justify-between gap-2"><span className="truncate text-[10px] text-muted-foreground">{session.project}</span><Badge variant="outline" className="h-4 border-foreground/15 px-1 text-[9px] text-muted-foreground">{label(session.last_status)}</Badge></div></Link></li>)}</ul>}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
