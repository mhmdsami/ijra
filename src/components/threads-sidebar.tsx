"use client";

import { MessageSquarePlus, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useSessions } from "@/components/sessions-context";
import { cn } from "@/lib/utils";

export function ThreadsSidebar() {
  const { sessions, showOwner } = useSessions();
  const [open, setOpen] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (localStorage.getItem("ijra-sidebar") === "0") setOpen(false);
  }, []);

  useEffect(() => {
    setPending(null);
  }, [pathname]);

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
            {sessions.map((session) => {
              const href = `/s/${session.id}`;
              return (
                <li key={session.id}>
                  <Link
                    href={href}
                    onClick={() => { if (pathname !== href) setPending(href); }}
                    className={cn(
                      "animate-fade-up relative block rounded-lg px-2 py-2.5 transition-colors hover:bg-secondary",
                      (pending ?? pathname) === href && "bg-secondary"
                    )}
                  >
                    <PendingDot />
                    <div className="truncate text-xs text-foreground">
                      {session.title || "Untitled request"}
                      {showOwner && session.owner_email && <span className="ml-1.5 text-[9px] text-muted-foreground/70">{session.owner_email.split("@")[0]}</span>}
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="truncate text-[10px] text-muted-foreground">{session.project}</span>
                      <StatusBadge status={session.last_status} />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}

function PendingDot() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={cn("absolute right-2 top-2 size-1.5 rounded-full bg-primary transition-opacity", pending ? "animate-pulse opacity-100" : "opacity-0")}
    />
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const label = !status ? "new" : status === "dispatching" || status === "running" ? "running" : status;
  return <Badge variant="outline" className="h-4 border-foreground/15 px-1 text-[9px] text-muted-foreground">{label}</Badge>;
}
