"use client";

import { createContext, useContext } from "react";
import type { SessionRowWithStatus } from "@/db";

interface SessionsValue {
  sessions: SessionRowWithStatus[];
  showOwner: boolean;
}

const SessionsContext = createContext<SessionsValue>({ sessions: [], showOwner: false });

export function SessionsProvider({ sessions, showOwner, children }: SessionsValue & { children: React.ReactNode }) {
  return <SessionsContext.Provider value={{ sessions, showOwner }}>{children}</SessionsContext.Provider>;
}

export function useSessions() {
  return useContext(SessionsContext);
}
