"use client";

import { useEffect, useState } from "react";

export function Quota({ refreshKey }: { refreshKey?: number }) {
  const [quota, setQuota] = useState<{ used: number; limit: number | null } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    void refreshKey;
    let live = true;
    const load = async () => {
      try {
        const response = await fetch("/api/quota");
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as { used: number; limit: number | null };
        if (live) {
          setQuota(data);
          setFailed(false);
        }
      } catch {
        if (live) setFailed(true);
      }
    };
    void load();
    const timer = setInterval(load, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      live = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refreshKey]);
  if (failed) return <span role="status">usage unavailable</span>;
  if (!quota || quota.limit === null) return null;
  return (
    <span className="tabular-nums">
      {quota.used}/{quota.limit} used today
    </span>
  );
}
