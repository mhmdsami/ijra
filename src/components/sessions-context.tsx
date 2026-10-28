"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { SessionRowWithStatus } from "@/db";
import { SESSIONS_PAGE_MAX, SESSIONS_PAGE_SIZE } from "@/lib/session-list";

interface SessionsValue {
  sessions: SessionRowWithStatus[];
  showOwner: boolean;
  projects: string[];
  query: string;
  setQuery: (query: string) => Promise<void>;
  project: string;
  setProject: (project: string) => Promise<void>;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

const REFRESH_MS = 20_000;

const SessionsContext = createContext<SessionsValue>({
  sessions: [],
  showOwner: false,
  projects: [],
  query: "",
  setQuery: async () => {},
  project: "",
  setProject: async () => {},
  hasMore: false,
  loadingMore: false,
  loadMore: async () => {},
  refresh: async () => {},
});

export function SessionsProvider({
  sessions: initialSessions,
  initialHasMore = false,
  viewerId,
  projects,
  children,
}: {
  sessions: SessionRowWithStatus[];
  initialHasMore?: boolean;
  viewerId: string;
  projects: string[];
  children: React.ReactNode;
}) {
  const [sessions, setSessions] = useState(initialSessions);
  const [query, setQueryState] = useState("");
  const [project, setProjectState] = useState("");
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const inFlight = useRef(false);
  const loadingRef = useRef(false);
  const queryRef = useRef("");
  const projectRef = useRef("");
  const countRef = useRef(initialSessions.length);
  const requestId = useRef(0);

  const fetchPage = useCallback(async (search: string, projectFilter: string, offset: number, limit: number) => {
    const id = ++requestId.current;
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (search) params.set("q", search);
    if (projectFilter) params.set("project", projectFilter);
    const res = await fetch(`/api/sessions?${params.toString()}`, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return null;
    const data = (await res.json().catch(() => null)) as {
      sessions?: SessionRowWithStatus[];
      hasMore?: boolean;
    } | null;
    if (!data || !Array.isArray(data.sessions) || typeof data.hasMore !== "boolean") return null;
    if (id !== requestId.current) return null;
    return { sessions: data.sessions, hasMore: data.hasMore };
  }, []);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const limit = Math.max(SESSIONS_PAGE_SIZE, Math.min(countRef.current, SESSIONS_PAGE_MAX));
      const data = await fetchPage(queryRef.current, projectRef.current, 0, limit);
      if (!data) return;
      countRef.current = data.sessions.length;
      setSessions(data.sessions);
      setHasMore(data.hasMore);
    } finally {
      inFlight.current = false;
    }
  }, [fetchPage]);

  const setQuery = useCallback(
    async (next: string) => {
      queryRef.current = next;
      setQueryState(next);
      const data = await fetchPage(next, projectRef.current, 0, SESSIONS_PAGE_SIZE);
      if (!data) return;
      countRef.current = data.sessions.length;
      setSessions(data.sessions);
      setHasMore(data.hasMore);
    },
    [fetchPage],
  );

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoadingMore(true);
    try {
      const data = await fetchPage(queryRef.current, projectRef.current, countRef.current, SESSIONS_PAGE_SIZE);
      if (!data) return;
      countRef.current += data.sessions.length;
      setSessions((current) => [...current, ...data.sessions]);
      setHasMore(data.hasMore);
    } finally {
      loadingRef.current = false;
      setLoadingMore(false);
    }
  }, [fetchPage, hasMore]);

  const setProject = useCallback(
    async (next: string) => {
      projectRef.current = next;
      setProjectState(next);
      const data = await fetchPage(queryRef.current, next, 0, SESSIONS_PAGE_SIZE);
      if (!data) return;
      countRef.current = data.sessions.length;
      setSessions(data.sessions);
      setHasMore(data.hasMore);
    },
    [fetchPage],
  );

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
    <SessionsContext.Provider
      value={{
        sessions,
        showOwner: sessions.some((session) => session.owner_id !== viewerId),
        projects,
        query,
        setQuery,
        project,
        setProject,
        hasMore,
        loadingMore,
        loadMore,
        refresh,
      }}
    >
      {children}
    </SessionsContext.Provider>
  );
}

export function useSessions() {
  return useContext(SessionsContext);
}
