"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { SessionRowWithStatus } from "@/db";

interface SessionsValue {
  sessions: SessionRowWithStatus[];
  showOwner: boolean;
  refresh: () => Promise<void>;
}

const REFRESH_MS = 20_000;

const SessionsContext = createContext<SessionsValue>({ sessions: [], showOwner: false, refresh: async () => {} });

export function SessionsProvider({
  sessions: initialSessions,
  viewerId,
  children,
}: {
  sessions: SessionRowWithStatus[];
  viewerId: string;
  children: React.ReactNode;
}) {
  const [sessions, setSessions] = useState(initialSessions);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch("/api/sessions", { cache: "no-store" }).catch(() => null);
      if (!res?.ok) return;
      const next = (await res.json().catch(() => null)) as SessionRowWithStatus[] | null;
      if (Array.isArray(next)) setSessions(next);
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const interval = window.setInterval(refreshWhenVisible, REFRESH_MS);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refresh]);

  return (
    <SessionsContext.Provider value={{ sessions, showOwner: sessions.some((s) => s.owner_id !== viewerId), refresh }}>
      {children}
    </SessionsContext.Provider>
  );
}

export function useSessions() {
  return useContext(SessionsContext);
}
