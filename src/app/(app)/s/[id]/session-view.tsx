"use client";

import Link from "next/link";
import { MessageSquarePlus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { HeaderActions } from "@/app/header-actions";
import { MobileThreads } from "@/components/mobile-threads";
import { Wordmark } from "@/components/wordmark";
import { EmptyState } from "@/components/empty-state";
import { ComposerControls } from "@/components/composer-controls";
import { AttachmentTray, AttachButton, uploadImages, useImageQueue } from "@/components/image-attachments";
import { useSessions } from "@/components/sessions-context";
import { projectConfig } from "@/lib/projects";
import { canRetry } from "@/lib/runner/transitions";
import { cn } from "@/lib/utils";
import type { MessageRow, RunRow, SessionRow } from "@/db";
import type { StreamEvent } from "@/lib/types";

type RunResult = { ok: boolean; error?: string };

type State = { session: SessionRow; messages: MessageRow[]; runs: RunRow[]; ownerEmail: string | null; viewerId: string; canWrite: boolean; isAdmin: boolean; models: { id: string; label: string; vision: boolean }[]; defaultModel: string };
const ACTIVE = new Set(["dispatching", "running"]);

export function SessionView({ initial }: { initial: State }) {
  const [state, setState] = useState(initial);
  const [input, setInput] = useState("");
  const lastRunModel = [...initial.runs].reverse().find((run) => run.model)?.model;
  const startingModel = lastRunModel && initial.models.some((m) => m.id === lastRunModel) ? lastRunModel : initial.defaultModel;
  const [model, setModel] = useState<string>(startingModel);
  const [sending, setSending] = useState(false);
  const imageQueue = useImageQueue();
  const modelSupportsImages = state.models.find((m) => m.id === model)?.vision ?? false;
  const [sendError, setSendError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [live, setLive] = useState<{ text: string; tools: string[]; stage: string }>({ text: "", tools: [], stage: "" });
  const bottomRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { sessions, refresh } = useSessions();
  const refreshedSidebar = useRef(false);
  const reviewSynced = useRef(false);
  const anyActive = state.runs.some((r) => ACTIVE.has(r.status));
  const anyReview = state.runs.some((r) => r.status === "awaiting_review");
  const activeRun = state.runs.find((r) => ACTIVE.has(r.status));
  const dispatchAt = activeRun?.dispatch_at ?? 0;
  const latestRun = [...state.runs].reverse().find((r) => !ACTIVE.has(r.status) && (r.pr_url || r.status === "blocked"));
  const lastRun = state.runs.at(-1);
  const hasAgentMessage = state.messages.some((m) => m.role === "agent");
  const silentRun = !!lastRun && !hasAgentMessage && (lastRun.status === "answered" || lastRun.status === "no_changes");

  const [pollFailing, setPollFailing] = useState(false);
  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${initial.session.id}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as Pick<State, "messages" | "runs">;
      setPollFailing(false);
      setState((state) => ({ ...state, ...data }));
    } catch {
      setPollFailing(true);
    }
  }, [initial.session.id]);

  useEffect(() => {
    if (anyActive || !anyReview) {
      reviewSynced.current = false;
      return;
    }
    if (reviewSynced.current) return;
    reviewSynced.current = true;
    void poll();
  }, [anyActive, anyReview, poll]);

  useEffect(() => {
    if (refreshedSidebar.current) return;
    if (!sessions.some((s) => s.id === initial.session.id)) {
      refreshedSidebar.current = true;
      void refresh();
    }
  }, [sessions, initial.session.id, refresh]);

  useEffect(() => {
    if (!anyActive) {
      setLive({ text: "", tools: [], stage: "" });
      return;
    }
    const source = new EventSource(`/api/sessions/${initial.session.id}/stream`);
    source.onmessage = (message) => {
      let event: StreamEvent;
      try {
        event = JSON.parse(message.data) as StreamEvent;
      } catch {
        return;
      }
      if (event.type === "text") setLive((current) => ({ ...current, text: (current.text + event.text).slice(-4000) }));
      else if (event.type === "tool") setLive((current) => ({ ...current, tools: [...current.tools, event.text].slice(-6) }));
      else if (event.type === "stage") setLive((current) => ({ ...current, stage: event.text }));
      else if (event.type === "done") {
        source.close();
        poll();
      }
    };
    source.onerror = () => source.close();
    return () => source.close();
  }, [anyActive, initial.session.id, poll]);

  useEffect(() => {
    if (!anyActive) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const warm = Date.now() - dispatchAt < 15_000;
      timer = setTimeout(tick, document.visibilityState === "visible" ? (warm ? 1500 : 5000) : 15_000);
    };
    const tick = async () => {
      if (!alive) return;
      if (document.visibilityState === "visible") await poll();
      if (alive) schedule();
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      clearTimeout(timer);
      tick();
    };
    schedule();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [anyActive, dispatchAt, poll]);

  useEffect(() => {
    const scroller = bottomRef.current?.parentElement;
    if (!scroller) return;
    const nearBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 240;
    if (nearBottom) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages.length]);

  async function send() {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setSendError(null);
    setInput("");
    setState((s) => ({
      ...s,
      messages: [...s.messages, { id: -Date.now(), session_id: s.session.id, role: "user", content, meta: null, created_at: Date.now() }],
      runs: [...s.runs, { id: "pending", session_id: s.session.id, project: s.session.project, request: content, model, mode: initial.canWrite ? "auto" : "ask", status: "dispatching", gh_run_id: null, gh_run_url: null, pr_url: null, branch: null, safe_zone: null, agent_msg: 0, dispatch_at: Date.now(), updated_at: Date.now(), requested_by: null, parent_run_id: null, policy_status: "pending", policy_reasons: null, decision: null, decided_by: null, decided_at: null, decision_reason: null, error_detail: null }],
    }));
    try {
      const imageIds = imageQueue.images.length > 0 ? await uploadImages(initial.session.id, imageQueue.images) : [];
      const res = await fetch(`/api/sessions/${initial.session.id}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content, model, imageIds }),
      });
      if (res.ok) {
        const data = (await res.json()) as Pick<State, "messages" | "runs">;
        setState((state) => ({ ...state, ...data }));
        imageQueue.clear();
      } else {
        const body = await res.json().catch(() => null) as { error?: string } | null;
        setInput((current) => (current.trim() === "" ? content : current));
        setSendError(body?.error ?? "Unable to send request.");
      }
    } catch (e) {
      setInput((current) => (current.trim() === "" ? content : current));
      setSendError(e instanceof Error && e.message ? e.message : "Unable to send request. Check your connection and try again.");
    } finally {
      setSending(false);
      poll();
    }
  }

  async function cancelRun() {
    if (!activeRun || activeRun.id === "pending") return;
    const res = await fetch(`/api/sessions/${initial.session.id}/cancel`, { method: "POST" });
    if (res.ok) {
      const data = (await res.json()) as { runs: RunRow[] };
      setState((s) => ({ ...s, runs: data.runs }));
    }
    poll();
  }

  async function runAction(runId: string, action: "merge" | "reject" | "retry", body?: Record<string, unknown>): Promise<RunResult> {
    if (runId === "pending") return { ok: false, error: "The run has not started yet." };
    setActing(runId);
    try {
      const res = await fetch(`/api/runs/${runId}/${action}`, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = (await res.json().catch(() => null)) as { runs?: RunRow[]; error?: string } | null;
      if (!res.ok) return { ok: false, error: data?.error ?? "The action failed." };
      if (data?.runs) setState((s) => ({ ...s, runs: data.runs as RunRow[] }));
      return { ok: true };
    } catch {
      return { ok: false, error: "The action failed. Check your connection and try again." };
    } finally {
      setActing(null);
      void refresh();
    }
  }

  async function deleteThread() {
    if (!confirm("Delete this thread?")) return;
    const res = await fetch(`/api/sessions/${initial.session.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      setSendError("Could not delete the thread. Try again.");
      return;
    }
    router.push("/");
  }

  return (
    <div className="animate-fade-up flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <MobileThreads />
          <Link href="/" aria-label="ijra home" className="rounded-sm">
            <Wordmark />
          </Link>
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          <Link
            href={`https://github.com/${projectConfig(state.session.project).repo}`}
            target="_blank"
            rel="noreferrer"
            className="max-w-[28vw] truncate rounded-md border border-border px-2 py-0.5 text-2xs text-text-secondary transition-colors hover:text-foreground"
          >
            {state.session.project}
          </Link>
          {state.session.owner_id && state.session.owner_id !== state.viewerId && state.ownerEmail && (
            <span className="hidden truncate text-2xs text-text-tertiary sm:inline" title="Session owner">{state.ownerEmail}</span>
          )}
          <Button onClick={deleteThread} variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" aria-label="Delete thread">
            <Trash2 className="size-3.5" />
          </Button>
          <HeaderActions />
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-4 sm:px-6">
        {state.messages.length > 0 && <h1 className="sr-only">{state.session.title || "Untitled request"}</h1>}
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto py-6 sm:gap-7 sm:py-10">
          {state.messages.length === 0 && (
            <EmptyState
              icon={MessageSquarePlus}
              title="Describe the change."
              description={initial.canWrite ? "The agent works in the repo and opens a pull request for review." : "Ask questions about this repository. Changes need a project grant."}
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  {["Fix a failing test", "Explain this folder", "Update a dependency"].map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => {
                        setInput(suggestion);
                        document.getElementById("composer-input")?.focus();
                      }}
                      className="rounded-md border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              }
              className="flex-1 justify-center py-8"
            />
          )}
          {state.messages.map((m, index) => <Message key={m.id} index={index} role={m.role} content={m.content} meta={m.meta} />)}
          {anyActive && (
            <div role="status">
              <StatusLine runs={state.runs} onCancel={cancelRun} stage={live.stage} />
            </div>
          )}
          {anyActive && pollFailing && (
            <p role="status" className="text-2xs text-text-tertiary">Live updates are failing. The run continues on GitHub.</p>
          )}
          {anyActive && (live.text.length > 0 || live.tools.length > 0) && (
            <div role="log" aria-label="Live agent output" className="animate-fade-up flex flex-col gap-2 rounded-lg border bg-surface-1/60 p-3">
              {live.tools.length > 0 && (
                <div className="flex flex-col gap-0.5 font-mono text-2xs text-text-tertiary">
                  {live.tools.map((tool, index) => <span key={`${index}-${tool}`} className="truncate">› {tool}</span>)}
                </div>
              )}
              {live.text.length > 0 && (
                <p className="max-h-40 overflow-y-auto text-xs leading-5 break-words whitespace-pre-wrap text-foreground/80">{live.text}</p>
              )}
            </div>
          )}
          {!anyActive && <PrCard run={latestRun} isAdmin={initial.isAdmin} onAction={runAction} busy={acting === latestRun?.id} />}
          <div ref={bottomRef} />
        </div>

        <div className="shrink-0 pt-2 pb-4 sm:pb-5">
          {sendError && <p role="alert" className="mb-2 text-xs text-destructive">{sendError}</p>}
          {(silentRun || lastRun?.status === "failed" || lastRun?.status === "cancelled") && (
            <div className="mb-2 space-y-1.5">
              <p role="status" className="text-xs text-destructive">
                {lastRun?.status === "failed" ? "The run failed." : lastRun?.status === "cancelled" ? "The run was cancelled." : "The run finished without a reply."}
                {lastRun?.status === "failed" && !initial.isAdmin ? " Ask an admin to check the run logs." : ""}
                {lastRun?.gh_run_url && (
                  <> <a href={lastRun.gh_run_url} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-foreground">Open the run logs</a></>
                )}
              </p>
              {initial.isAdmin && lastRun && canRetry(lastRun.status) && (
                <Button size="xs" variant="outline" onClick={() => runAction(lastRun.id, "retry")} disabled={acting === lastRun.id}>
                  {acting === lastRun.id ? "Retrying…" : "Retry"}
                </Button>
              )}
              {initial.isAdmin && lastRun?.error_detail && (
                <details className="rounded-md border bg-card px-3 py-2">
                  <summary className="cursor-pointer text-2xs text-text-tertiary">Error details</summary>
                  <pre className="mt-2 max-h-48 overflow-auto font-mono text-2xs whitespace-pre-wrap break-words text-destructive">{lastRun.error_detail}</pre>
                </details>
              )}
            </div>
          )}
          <div className="rounded-xl border bg-card p-2.5 shadow-card sm:p-3">
            <AttachmentTray images={imageQueue.images} onRemove={imageQueue.remove} />
            <Textarea value={input} id="composer-input" onChange={(e) => { setInput(e.target.value); setSendError(null); }} onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); }
            }} onPaste={(e) => {
              const files = [...e.clipboardData.items].filter((item) => item.kind === "file").map((item) => item.getAsFile()).filter((file): file is File => !!file);
              if (files.length > 0 && modelSupportsImages) { e.preventDefault(); imageQueue.add(files); }
            }} placeholder="Ask a question or describe a change" rows={2} aria-label="Message to ijra" className="min-h-10 w-full resize-none border-0 bg-transparent px-1.5 py-1 text-base leading-6 shadow-none focus-visible:ring-0 sm:min-h-12 sm:px-2 sm:py-1.5" />
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-2.5 text-2xs text-text-tertiary">
              {modelSupportsImages && <AttachButton onFiles={imageQueue.add} disabled={sending || imageQueue.images.length >= 3} />}
              <span className={cn("hidden transition-opacity duration-150 sm:inline", input ? "opacity-0" : "opacity-100")}>Enter to send</span>
              <Quota refreshKey={state.runs.length} />
              <span className="ml-auto max-[380px]:ml-0 max-[380px]:w-full">
                <ComposerControls
                  className="max-[380px]:w-full"
                  model={model}
                  models={state.models}
                  onModel={setModel}
                  onSend={send}
                  busy={sending}
                  disabled={!input.trim()}
                />
              </span>
            </div>
          </div>
          {imageQueue.error && <p role="alert" className="mt-2 text-xs text-destructive">{imageQueue.error}</p>}
        </div>
      </div>
    </div>
  );
}

function Quota({ refreshKey }: { refreshKey?: number }) {
  const [quota, setQuota] = useState<{ used: number; limit: number | null } | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/quota")
      .then((r) => (r.ok ? r.json() : null))
      .then((q) => { if (live && q) setQuota(q as { used: number; limit: number | null }); })
      .catch(() => {});
    return () => { live = false; };
  }, [refreshKey]);
  if (!quota || quota.limit === null) return null;
  return <span>{quota.used}/{quota.limit} used today</span>;
}

function Message({ role, content, meta, index }: { role: string; content: string; meta?: string | null; index: number }) {
  const isUser = role === "user";
  let imageIds: string[] = [];
  try {
    const parsed = meta ? (JSON.parse(meta) as { imageIds?: string[] }) : null;
    if (Array.isArray(parsed?.imageIds)) imageIds = parsed.imageIds.filter((id) => typeof id === "string");
  } catch {
  }
  return (
    <article className="animate-fade-up border-l border-border pl-4" style={{ animationDelay: `${Math.min(index, 6) * 30}ms` }}>
      <p className={cn("type-label mb-2", isUser ? "text-primary" : "text-text-tertiary")}>{isUser ? "You" : "ijra"}</p>
      {isUser ? (
        <>
          {imageIds.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {imageIds.map((id) => <img key={id} src={`/api/images/${id}`} alt="" className="size-20 rounded-lg border object-cover" />)}
            </div>
          )}
          <div className="text-base leading-6 break-words whitespace-pre-wrap">{content}</div>
        </>
      ) : (
        <Markdown text={content} />
      )}
    </article>
  );
}

function Markdown({ text }: { text: string }) {
  return (
    <div className="space-y-3 text-base leading-6 break-words [&_a]:break-all [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_code]:rounded-sm [&_code]:bg-surface-2 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_h1,h2,h3]:text-lg [&_h1,h2,h3]:font-medium [&_h1,h2,h3]:tracking-[-0.01em] [&_li]:ml-4 [&_ol]:list-decimal [&_p]:m-0 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:bg-surface-1 [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_strong]:font-medium [&_ul]:list-disc">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

function StatusLine({ runs, onCancel, stage }: { runs: RunRow[]; onCancel: () => void; stage?: string }) {
  const latest = runs.at(-1);
  if (!latest) return null;
  const base = latest.status === "dispatching" ? "Dispatching request" : latest.status === "running" ? "Agent is working" : null;
  const label = stage ? `${base}: ${stage}` : base;
  if (!label) return null;
  return (
    <div className="animate-fade-up flex items-center gap-2 text-xs text-primary">
      <span className="size-1.5 animate-pulse rounded-full bg-primary" />
      {label}
      <button onClick={onCancel} className="ml-1 text-text-tertiary underline underline-offset-4 transition-colors hover:text-foreground">
        cancel
      </button>
    </div>
  );
}

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

function PrCard({ run, isAdmin, onAction, busy }: {
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
    run.status === "awaiting_review" ? "Awaiting review"
    : run.status === "merged" ? "Merged"
    : run.status === "rejected" ? "Rejected"
    : run.status === "closed" ? "Closed"
    : run.status === "blocked" ? "Blocked"
    : run.status === "failed" ? "Failed"
    : run.status;
  const tone =
    run.status === "awaiting_review" ? "text-primary"
    : run.status === "merged" ? "text-primary"
    : "text-text-tertiary";

  let reasons: string[] = [];
  try { reasons = run.policy_reasons ? JSON.parse(run.policy_reasons) : []; } catch {}

  const canMerge = isAdmin && run.status === "awaiting_review" && !!run.pr_url;
  const canRetryHere = isAdmin && canRetry(run.status);

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
          <Badge variant="outline" className={cn("shrink-0 text-2xs", tone)}>{label}</Badge>
          {run.pr_url && (
            <a href={run.pr_url} target="_blank" rel="noreferrer" className="min-w-0 truncate text-xs underline underline-offset-4 hover:text-foreground">
              {run.pr_url.replace(/^https:\/\/github\.com\//, "")}
            </a>
          )}
          {run.branch && <span className="hidden shrink-0 font-mono text-2xs text-text-tertiary sm:inline">{run.branch}</span>}
        </div>
        {(canMerge || canRetryHere) && !rejecting && (
          <div className="flex shrink-0 items-center gap-1.5 sm:ml-auto">
            {canMerge && <Button size="xs" onClick={() => void act("merge")} disabled={busy}>{busy ? "Merging…" : "Merge"}</Button>}
            {canMerge && <Button size="xs" variant="ghost" onClick={() => { setRejecting(true); setError(null); }} disabled={busy}>Reject</Button>}
            {canRetryHere && <Button size="xs" variant="outline" onClick={() => void act("retry")} disabled={busy}>{busy ? "Retrying…" : "Retry"}</Button>}
          </div>
        )}
        {!canMerge && !canRetryHere && reasons.length > 0 && (
          <span className="text-2xs text-text-tertiary sm:ml-auto" title={reasons[0]}>{shortReason(reasons[0])}</span>
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
            <Button type="submit" size="xs" variant="destructive" disabled={!reason.trim() || busy}>{busy ? "Rejecting…" : "Reject"}</Button>
            <Button type="button" size="xs" variant="ghost" onClick={() => { setRejecting(false); setReason(""); setError(null); }}>Cancel</Button>
          </div>
        </form>
      )}
      {error && <p role="alert" className="text-2xs text-destructive">{error}</p>}
    </div>
  );
}
