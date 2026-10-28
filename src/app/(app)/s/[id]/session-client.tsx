"use client";

import dynamic from "next/dynamic";
import type { SessionInitial } from "./session-view";

const SessionView = dynamic(() => import("./session-view").then((module) => module.SessionView), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center text-xs text-text-tertiary">Loading thread…</div>
  ),
});

export function SessionClient({ initial }: { initial: SessionInitial }) {
  return <SessionView initial={initial} />;
}
