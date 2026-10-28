"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { RunRow } from "@/db";
import { canRetry } from "@/lib/runner/transitions";
import { formatCost, formatTokens } from "@/lib/runner/usage";
import { cn } from "@/lib/utils";

export type RunResult = { ok: boolean; error?: string };

function shortReason(reason: string) {
  const idx = reason.indexOf(":");
  if (idx === -1) return reason;
  const paths = reason
    .slice(idx + 1)
    .split(",")
    .map((part) => part.trim().split("/").filter(Boolean).pop() ?? part.trim())
    .join(", ");
  return `${reason.slice(0, idx)}: ${paths}`;
}

export function PrCard({
  run,
  isAdmin,
  onAction,
  busy,
}: {
  run: RunRow | undefined;
  isAdmin: boolean;
  onAction: (runId: string, action: "merge" | "reject" | "retry", body?: Record<string, unknown>) => Promise<RunResult>;
  busy: boolean;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (!run || (!run.pr_url && run.status !== "blocked")) return null;

  const label =
    run.status === "awaiting_review"
      ? "Awaiting review"
      : run.status === "merged"
        ? "Merged"
        : run.status === "rejected"
          ? "Rejected"
          : run.status === "closed"
            ? "Closed"
            : run.status === "blocked"
              ? "Blocked"
              : run.status === "failed"
                ? "Failed"
                : run.status;
  const tone =
    run.status === "awaiting_review" ? "text-primary" : run.status === "merged" ? "text-primary" : "text-text-tertiary";

  let reasons: string[] = [];
  try {
    reasons = run.policy_reasons ? JSON.parse(run.policy_reasons) : [];
  } catch {}

  const canMerge = isAdmin && run.status === "awaiting_review" && !!run.pr_url;
  const canRetryHere = isAdmin && canRetry(run.status);
  const tokens = run.input_tokens + run.output_tokens;
  const usage = [tokens > 0 ? `${formatTokens(tokens)} tok` : null, run.cost_usd > 0 ? formatCost(run.cost_usd) : null]
    .filter(Boolean)
    .join(" · ");

  const act = async (action: "merge" | "reject" | "retry", body?: Record<string, unknown>) => {
    setError(null);
    const result = await onAction(run.id, action, body);
    if (!result.ok) {
      setError(result.error ?? "The action failed.");
      return;
    }
    setRejecting(false);
    setReason("");
  };

  return (
    <div className="animate-fade-up flex flex-col gap-2 rounded-lg border bg-card px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Badge variant="outline" className={cn("shrink-0 text-2xs", tone)}>
            {label}
          </Badge>
          {run.pr_url && (
            <a
              href={run.pr_url}
              target="_blank"
              rel="noreferrer"
              className="min-w-0 truncate text-xs underline underline-offset-4 hover:text-foreground"
            >
              {run.pr_url.replace(/^https:\/\/github\.com\//, "")}
            </a>
          )}
          {run.branch && (
            <span className="hidden shrink-0 font-mono text-2xs text-text-tertiary sm:inline">{run.branch}</span>
          )}
          {run.checks_status && run.checks_status !== "none" && (
            <span
              className={cn(
                "shrink-0 font-mono text-2xs",
                run.checks_status === "failing"
                  ? "text-destructive"
                  : run.checks_status === "pending"
                    ? "text-text-tertiary"
                    : "text-primary",
              )}
            >
              checks {run.checks_status}
            </span>
          )}
          {usage && <span className="shrink-0 font-mono text-2xs text-text-tertiary tabular-nums">{usage}</span>}
        </div>
        {(canMerge || canRetryHere) && !rejecting && (
          <div className="flex shrink-0 items-center justify-end gap-1.5 sm:ml-auto">
            {canMerge && (
              <Button size="xs" onClick={() => void act("merge")} disabled={busy}>
                {busy ? "Merging…" : "Merge"}
              </Button>
            )}
            {canMerge && (
              <Button
                size="xs"
                variant="ghost"
                onClick={() => {
                  setRejecting(true);
                  setError(null);
                }}
                disabled={busy}
              >
                Reject
              </Button>
            )}
            {canRetryHere && (
              <Button size="xs" variant="outline" onClick={() => void act("retry")} disabled={busy}>
                {busy ? "Retrying…" : "Retry"}
              </Button>
            )}
          </div>
        )}
        {!canMerge && !canRetryHere && reasons.length > 0 && (
          <span className="text-2xs text-text-tertiary sm:ml-auto" title={reasons[0]}>
            {shortReason(reasons[0])}
          </span>
        )}
      </div>
      {run.status === "rejected" && run.decision_reason && (
        <p className="text-2xs text-text-tertiary">Rejected: {run.decision_reason}</p>
      )}
      {rejecting && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (reason.trim()) void act("reject", { reason: reason.trim() });
          }}
        >
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Why is this change being rejected?"
            aria-label="Rejection reason"
            className="min-h-10 text-xs"
            autoFocus
          />
          <div className="flex items-center gap-1.5">
            <Button type="submit" size="xs" variant="destructive" disabled={!reason.trim() || busy}>
              {busy ? "Rejecting…" : "Reject"}
            </Button>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => {
                setRejecting(false);
                setReason("");
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="text-2xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
