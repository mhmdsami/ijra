"use client";

import { MessageSquarePlus, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { useSessions } from "@/components/sessions-context";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function ThreadsSidebar() {
  const { sessions, showOwner } = useSessions();
  const [open, setOpen] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (localStorage.getItem("ijra-sidebar") === "0") setOpen(false);
  }, []);

  // pathname is an intentional trigger; the body resets pending navigation.
  // biome-ignore lint/correctness/useExhaustiveDependencies: clear pending on navigation
  useEffect(() => {
    setPending(null);
  }, [pathname]);

  // If navigation fails, the pathname never changes; do not leave the highlight stuck.
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setPending(null), 10_000);
    return () => clearTimeout(timer);
  }, [pending]);

  function toggle() {
    setOpen((v) => {
      localStorage.setItem("ijra-sidebar", v ? "0" : "1");
      return !v;
    });
  }

  if (!open) {
    return (
      <div className="hidden w-12 shrink-0 flex-col items-center gap-1 border-r py-2 md:flex">
        <button
          type="button"
          onClick={toggle}
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          aria-label="Show threads"
        >
          <PanelLeftOpen className="size-4" />
        </button>
        <Link
          href="/"
          className="rounded-md p-2 text-primary transition-colors hover:bg-surface-2"
          aria-label="New thread"
        >
          <MessageSquarePlus className="size-4" />
        </Link>
      </div>
    );
  }

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r md:flex">
      <div className="flex h-14 shrink-0 items-center justify-between px-4">
        <span className="type-label text-text-tertiary">Threads</span>
        <div className="flex items-center gap-0.5">
          <Link
            href="/"
            className="rounded-md p-1.5 text-primary transition-colors hover:bg-surface-2"
            aria-label="New thread"
          >
            <MessageSquarePlus className="size-4" />
          </Link>
          <button
            type="button"
            onClick={toggle}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            aria-label="Hide threads"
          >
            <PanelLeftClose className="size-4" />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {sessions.length === 0 ? (
          <EmptyState variant="inline" title="No threads yet" description="Your requests will appear here." />
        ) : (
          <ul className="flex flex-col gap-0.5">
            {sessions.map((session) => {
              const href = `/s/${session.id}`;
              return (
                <li key={session.id}>
                  <Link
                    href={href}
                    aria-current={pathname === href ? "page" : undefined}
                    onClick={() => {
                      if (pathname !== href) setPending(href);
                    }}
                    className={cn(
                      "animate-fade-up relative block rounded-md px-2.5 py-2 transition-colors hover:bg-surface-2",
                      (pending ?? pathname) === href && "bg-surface-2",
                    )}
                  >
                    <PendingDot />
                    <div className="truncate text-sm text-foreground">
                      {session.title || "Untitled request"}
                      {showOwner && session.owner_email && (
                        <span className="ml-1.5 text-2xs text-text-tertiary">{session.owner_email.split("@")[0]}</span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="truncate text-2xs text-text-tertiary">{session.project}</span>
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
      className={cn(
        "absolute top-2.5 right-2 size-1.5 rounded-full bg-primary transition-opacity",
        pending ? "animate-pulse opacity-100" : "opacity-0",
      )}
    />
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const running = status === "dispatching" || status === "running";
  const label = !status ? "new" : running ? "running" : status.replaceAll("_", " ");
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-4 max-w-[9.5rem] truncate border-border px-1 text-2xs text-text-tertiary",
        running && "animate-pulse text-primary",
      )}
    >
      {label}
    </Badge>
  );
}
