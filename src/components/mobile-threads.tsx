"use client";

import { Menu, MessageSquarePlus, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SessionEmpty, SessionLoadMore, SessionSearch } from "@/components/session-search";
import { useSessions } from "@/components/sessions-context";
import { cn } from "@/lib/utils";

export function MobileThreads() {
  const { sessions } = useSessions();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);

  function trapTab(e: React.KeyboardEvent) {
    if (e.key !== "Tab") return;
    const focusables = closeRef.current
      ?.closest("aside")
      ?.querySelectorAll<HTMLAnchorElement | HTMLButtonElement>("a[href], button:not([disabled])");
    if (!focusables || focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      openerRef.current?.focus();
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        ref={openerRef}
        onClick={() => setOpen(true)}
        className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
        aria-label="Open threads"
      >
        <Menu className="size-4" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-background/75 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-label="Close threads"
            tabIndex={-1}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Threads"
            onKeyDown={trapTab}
            className="relative flex h-full w-[min(19rem,86vw)] flex-col border-r bg-background shadow-overlay"
          >
            <div className="flex h-14 items-center justify-between px-4">
              <span className="type-label text-text-tertiary">Threads</span>
              <div className="flex items-center gap-1">
                <Link
                  href="/"
                  onClick={() => setOpen(false)}
                  className="inline-flex size-11 items-center justify-center rounded-md text-primary transition-colors hover:bg-surface-2"
                  aria-label="New thread"
                >
                  <MessageSquarePlus className="size-4" />
                </Link>
                <button
                  type="button"
                  ref={closeRef}
                  onClick={() => setOpen(false)}
                  className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                  aria-label="Close threads"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
            <div className="px-2 pb-1">
              <SessionSearch />
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-1">
              {sessions.length === 0 ? (
                <SessionEmpty onStart={() => setOpen(false)} />
              ) : (
                <ul className="flex flex-col gap-0.5">
                  {sessions.map((session) => (
                    <li key={session.id}>
                      <Link
                        href={`/s/${session.id}`}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "block rounded-md px-2.5 py-2 transition-colors hover:bg-surface-2",
                          pathname === `/s/${session.id}` && "bg-surface-2",
                        )}
                      >
                        <div className="truncate text-sm">{session.title || "Untitled request"}</div>
                        <div className="mt-1 truncate text-2xs text-text-tertiary">{session.project}</div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <SessionLoadMore className="mt-1" />
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
