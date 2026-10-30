"use client";

import { ArrowDown, MessageSquarePlus, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { HeaderActions } from "@/app/header-actions";
import { ComposerControls } from "@/components/composer-controls";
import { EmptyState } from "@/components/empty-state";
import { AttachButton, AttachmentTray, uploadImages, useImageQueue } from "@/components/image-attachments";
import { MobileThreads } from "@/components/mobile-threads";
import { useSessions } from "@/components/sessions-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Wordmark } from "@/components/wordmark";
import type { MessageRow, RunRow, SessionRow } from "@/db";
import { projectConfig } from "@/lib/projects";
import { canRetry } from "@/lib/runner/transitions";
import { anchorMessageId, type PrCardGroup, pendingBlockedRun, prCardGroups } from "@/lib/session-timeline";
import type { StreamEvent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Message } from "./message";
import { PrCard, type RunResult } from "./pr-card";
import { Quota } from "./quota";
import { StatusLine } from "./status-line";
import { TitleDialog } from "./title-dialog";

export type SessionInitial = {
  session: SessionRow;
  messages: MessageRow[];
  runs: RunRow[];
  ownerEmail: string | null;
  viewerId: string;
  canWrite: boolean;
  isAdmin: boolean;
  models: { id: string; label: string; vision: boolean }[];
  defaultModel: string;
};

const ACTIVE = new Set(["dispatching", "running"]);
const NEAR_BOTTOM = 240;

export function SessionView({ initial }: { initial: SessionInitial }) {
  const [state, setState] = useState<SessionInitial>(initial);
  const [input, setInput] = useState("");
  const lastRunModel = [...initial.runs].reverse().find((run) => run.model)?.model;
  const startingModel =
    lastRunModel && initial.models.some((m) => m.id === lastRunModel) ? lastRunModel : initial.defaultModel;
  const [model, setModel] = useState<string>(startingModel);
  const [sending, setSending] = useState(false);
  const imageQueue = useImageQueue();
  const modelSupportsImages = state.models.find((m) => m.id === model)?.vision ?? false;
  const [sendError, setSendError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [showJump, setShowJump] = useState(false);
  const [titleOpen, setTitleOpen] = useState(false);
  const [live, setLive] = useState<{ text: string; tools: string[]; stage: string }>({
    text: "",
    tools: [],
    stage: "",
  });
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { sessions, refresh } = useSessions();
  const refreshedSidebar = useRef(false);
  const reviewSynced = useRef(false);
  const anyActive = state.runs.some((r) => ACTIVE.has(r.status));
  const anyReview = state.runs.some((r) => r.status === "awaiting_review");
  const activeRun = state.runs.find((r) => ACTIVE.has(r.status));
  const dispatchAt = activeRun?.dispatch_at ?? 0;
  const cardGroups = prCardGroups(state.runs);
  const cardsByMessage = new Map<number, PrCardGroup[]>();
  const trailingGroups: PrCardGroup[] = [];
  for (const group of cardGroups) {
    const anchor = anchorMessageId(group, state.messages);
    if (anchor === null) trailingGroups.push(group);
    else cardsByMessage.set(anchor, [...(cardsByMessage.get(anchor) ?? []), group]);
  }
  const blockedRun = pendingBlockedRun(state.runs);
  const canAct = initial.isAdmin && !anyActive;
  const lastRun = state.runs.at(-1);
  const hasAgentMessage = state.messages.some((m) => m.role === "agent");
  const silentRun = !!lastRun && !hasAgentMessage && (lastRun.status === "answered" || lastRun.status === "no_changes");

  const [pollFailing, setPollFailing] = useState(false);
  const [streamDown, setStreamDown] = useState(false);
  const [streamKey, setStreamKey] = useState(0);
  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${initial.session.id}/sync`, { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as Pick<SessionInitial, "messages" | "runs">;
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
    void streamKey;
    if (!anyActive) {
      setLive({ text: "", tools: [], stage: "" });
      setStreamDown(false);
      return;
    }
    let retry: ReturnType<typeof setTimeout> | undefined;
    const source = new EventSource(`/api/sessions/${initial.session.id}/stream`);
    source.onopen = () => setStreamDown(false);
    source.onmessage = (message) => {
      let event: StreamEvent;
      try {
        event = JSON.parse(message.data) as StreamEvent;
      } catch {
        return;
      }
      if (event.type === "text") setLive((current) => ({ ...current, text: (current.text + event.text).slice(-4000) }));
      else if (event.type === "tool")
        setLive((current) => ({ ...current, tools: [...current.tools, event.text].slice(-6) }));
      else if (event.type === "stage") setLive((current) => ({ ...current, stage: event.text }));
      else if (event.type === "done") {
        source.close();
        poll();
      }
    };
    source.onerror = () => {
      source.close();
      setStreamDown(true);
      retry = setTimeout(() => setStreamKey((key) => key + 1), 3_000);
    };
    return () => {
      source.close();
      if (retry) clearTimeout(retry);
    };
  }, [anyActive, initial.session.id, poll, streamKey]);

  useEffect(() => {
    if (!anyActive && !anyReview) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const visible = document.visibilityState === "visible";
      const warm = Date.now() - dispatchAt < 15_000;
      const delay = anyActive ? (visible ? (warm ? 1500 : 5000) : 15_000) : visible ? 20_000 : 60_000;
      timer = setTimeout(tick, delay);
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
  }, [anyActive, anyReview, dispatchAt, poll]);

  useEffect(() => {
    const messageCount = state.messages.length;
    if (messageCount === 0) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const nearBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < NEAR_BOTTOM;
    if (nearBottom) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowJump(!nearBottom);
  }, [state.messages.length]);

  function onScroll() {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    setShowJump(scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight > NEAR_BOTTOM);
  }

  function jumpToLatest() {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
  }

  async function send() {
    const content = input.trim();
    if (!content || sending || anyActive) return;
    setSending(true);
    setSendError(null);
    setInput("");
    setState((s) => ({
      ...s,
      messages: [
        ...s.messages,
        {
          id: -Date.now(),
          session_id: s.session.id,
          role: "user",
          content,
          meta: null,
          run_id: null,
          created_at: Date.now(),
        },
      ],
      runs: [
        ...s.runs,
        {
          id: "pending",
          session_id: s.session.id,
          project: s.session.project,
          request: content,
          model,
          mode: initial.canWrite ? "auto" : "ask",
          status: "dispatching",
          gh_run_id: null,
          gh_run_url: null,
          pr_url: null,
          branch: null,
          safe_zone: null,
          agent_msg: 0,
          dispatch_at: Date.now(),
          updated_at: Date.now(),
          requested_by: null,
          parent_run_id: null,
          policy_status: "pending",
          policy_reasons: null,
          checks_status: null,
          input_tokens: 0,
          output_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          cost_usd: 0,
          model_calls: 0,
          decision: null,
          decided_by: null,
          decided_at: null,
          decision_reason: null,
          error_detail: null,
        },
      ],
    }));
    try {
      const imageIds = imageQueue.images.length > 0 ? await uploadImages(initial.session.id, imageQueue.images) : [];
      const res = await fetch(`/api/sessions/${initial.session.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, model, imageIds }),
      });
      if (res.ok) {
        const data = (await res.json()) as Pick<SessionInitial, "messages" | "runs">;
        setState((state) => ({ ...state, ...data }));
        imageQueue.clear();
      } else {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setInput((current) => (current.trim() === "" ? content : current));
        setSendError(body?.error ?? "Unable to send request.");
      }
    } catch (e) {
      setInput((current) => (current.trim() === "" ? content : current));
      setSendError(
        e instanceof Error && e.message ? e.message : "Unable to send request. Check your connection and try again.",
      );
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

  async function runAction(
    runId: string,
    action: "merge" | "reject" | "retry",
    body?: Record<string, unknown>,
  ): Promise<RunResult> {
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

  const saveTitle = useCallback(
    async (next: string) => {
      try {
        const res = await fetch(`/api/sessions/${initial.session.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: next }),
        });
        const data = (await res.json().catch(() => null)) as { title?: string; error?: string } | null;
        if (!res.ok) return data?.error ?? `Could not rename the thread (${res.status}).`;
        setState((state) => ({ ...state, session: { ...state.session, title: data?.title ?? next } }));
        void refresh();
        return null;
      } catch {
        return "Could not rename the thread.";
      }
    },
    [initial.session.id, refresh],
  );

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
            <span className="hidden truncate text-2xs text-text-tertiary sm:inline" title="Session owner">
              {state.ownerEmail}
            </span>
          )}
          {state.isAdmin && (
            <Link
              href="/admin"
              className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              Admin
            </Link>
          )}
          <Button
            onClick={deleteThread}
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-destructive"
            aria-label="Delete thread"
          >
            <Trash2 className="size-3.5" />
          </Button>
          <HeaderActions />
        </div>
      </header>

      <div className="flex h-9 shrink-0 items-center gap-2 border-b px-4 sm:px-6">
        <h1 className="min-w-0 flex-1 truncate text-xs text-text-secondary">
          {state.session.title || "Untitled request"}
        </h1>
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label="Edit title"
          aria-haspopup="dialog"
          onClick={() => setTitleOpen(true)}
        >
          <Pencil className="size-3" />
        </Button>
      </div>
      <TitleDialog
        open={titleOpen}
        title={state.session.title}
        onClose={() => setTitleOpen(false)}
        onSave={saveTitle}
      />

      <div className="mx-auto flex min-h-0 w-full max-w-[45rem] flex-1 flex-col">
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div
            ref={scrollerRef}
            onScroll={onScroll}
            className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-6 [scrollbar-gutter:stable] sm:gap-7 sm:px-6 sm:py-10"
          >
            {state.messages.length === 0 && (
              <EmptyState
                icon={MessageSquarePlus}
                title="Describe the change."
                description={
                  initial.canWrite
                    ? "The agent works in the repo and opens a pull request for review."
                    : "Ask questions about this repository. Changes need a project grant."
                }
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
            {state.messages.map((m, index) => (
              <Fragment key={m.id}>
                <Message index={index} role={m.role} content={m.content} meta={m.meta} />
                {(cardsByMessage.get(m.id) ?? []).map((group) => (
                  <PrCard
                    key={group.url}
                    run={group.latestRun}
                    isAdmin={canAct}
                    onAction={runAction}
                    busy={acting === group.latestRun.id}
                  />
                ))}
              </Fragment>
            ))}
            {anyActive && (
              <div role="status">
                <StatusLine runs={state.runs} onCancel={cancelRun} stage={live.stage} />
              </div>
            )}
            {anyActive && (pollFailing || streamDown) && (
              <p role="status" className="text-2xs text-text-tertiary">
                {pollFailing
                  ? "Live updates are failing. The run continues on GitHub."
                  : "Live output paused. Status still updates."}
              </p>
            )}
            {anyActive && (live.text.length > 0 || live.tools.length > 0) && (
              <div
                role="log"
                aria-label="Live agent output"
                className="animate-fade-up flex flex-col gap-2 rounded-lg border bg-surface-1/60 p-3"
              >
                {live.tools.length > 0 && (
                  <div className="flex flex-col gap-0.5 font-mono text-2xs text-text-tertiary">
                    {live.tools.map((tool, index) => (
                      <span key={`${index}-${tool}`} className="truncate">
                        › {tool}
                      </span>
                    ))}
                  </div>
                )}
                {live.text.length > 0 && (
                  <p className="max-h-40 overflow-y-auto text-xs leading-5 break-words whitespace-pre-wrap text-foreground/80">
                    {live.text}
                  </p>
                )}
              </div>
            )}
            {trailingGroups.map((group) => (
              <PrCard
                key={group.url}
                run={group.latestRun}
                isAdmin={canAct}
                onAction={runAction}
                busy={acting === group.latestRun.id}
              />
            ))}
            {!anyActive && blockedRun && (
              <PrCard
                key={blockedRun.id}
                run={blockedRun}
                isAdmin={initial.isAdmin}
                onAction={runAction}
                busy={acting === blockedRun.id}
              />
            )}
            <div ref={bottomRef} />
          </div>
          {showJump && (
            <Button
              size="xs"
              variant="outline"
              onClick={jumpToLatest}
              className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 border bg-card shadow-card"
            >
              <ArrowDown />
              Jump to latest
            </Button>
          )}
        </div>

        <div className="shrink-0 pb-4 pl-4 pr-4 pt-2 sm:pb-5 sm:pl-6 sm:pr-0">
          {sendError && (
            <p role="alert" className="mb-2 text-xs text-destructive">
              {sendError}
            </p>
          )}
          {(silentRun || lastRun?.status === "failed" || lastRun?.status === "cancelled") && (
            <div className="mb-2 space-y-1.5">
              <div className="flex items-start justify-between gap-3">
                <p role="status" className="min-w-0 text-xs text-destructive">
                  {lastRun?.status === "failed"
                    ? "The run failed."
                    : lastRun?.status === "cancelled"
                      ? "The run was cancelled."
                      : "The run finished without a reply."}
                  {lastRun?.status === "failed" && !initial.isAdmin ? " Ask an admin to check the run logs." : ""}
                  {lastRun?.gh_run_url && (
                    <>
                      {" "}
                      <a
                        href={lastRun.gh_run_url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-4 hover:text-foreground"
                      >
                        Open the run logs
                      </a>
                    </>
                  )}
                </p>
                {initial.isAdmin && lastRun && canRetry(lastRun.status) && (
                  <Button
                    size="xs"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => runAction(lastRun.id, "retry")}
                    disabled={acting === lastRun.id}
                  >
                    {acting === lastRun.id ? "Retrying…" : "Retry"}
                  </Button>
                )}
              </div>
              {initial.isAdmin && lastRun?.error_detail && (
                <details className="rounded-md border bg-card px-3 py-2">
                  <summary className="cursor-pointer text-2xs text-text-tertiary">Error details</summary>
                  <pre className="mt-2 max-h-48 overflow-auto font-mono text-2xs whitespace-pre-wrap break-words text-destructive">
                    {lastRun.error_detail}
                  </pre>
                </details>
              )}
            </div>
          )}
          <div className="rounded-xl border bg-card p-2.5 shadow-card sm:p-3">
            {anyActive && (
              <p role="status" className="px-1.5 pb-2 text-2xs text-text-tertiary">
                A run is active
              </p>
            )}
            <AttachmentTray images={imageQueue.images} onRemove={imageQueue.remove} disabled={anyActive} />
            <Textarea
              value={input}
              id="composer-input"
              disabled={anyActive}
              onChange={(e) => {
                setInput(e.target.value);
                setSendError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send();
                }
              }}
              onPaste={(e) => {
                const files = [...e.clipboardData.items]
                  .filter((item) => item.kind === "file")
                  .map((item) => item.getAsFile())
                  .filter((file): file is File => !!file);
                if (files.length > 0 && modelSupportsImages) {
                  e.preventDefault();
                  imageQueue.add(files);
                }
              }}
              placeholder="Ask a question or describe a change"
              rows={2}
              aria-label="Message to ijra"
              className="min-h-10 w-full resize-none border-0 bg-transparent px-1.5 py-1 text-base leading-6 shadow-none focus-visible:ring-0 sm:min-h-12 sm:px-2 sm:py-1.5"
            />
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-2.5 text-2xs text-text-tertiary">
              {modelSupportsImages && (
                <AttachButton
                  onFiles={imageQueue.add}
                  disabled={anyActive || sending || imageQueue.images.length >= 3}
                />
              )}
              <span
                className={cn("hidden transition-opacity duration-150 sm:inline", input ? "opacity-0" : "opacity-100")}
              >
                Enter to send
              </span>
              <Quota refreshKey={state.runs.length} />
              <span className="ml-auto max-[380px]:ml-0 max-[380px]:w-full">
                <ComposerControls
                  className="max-[380px]:w-full"
                  model={model}
                  models={state.models}
                  onModel={setModel}
                  onSend={send}
                  busy={sending}
                  disabled={anyActive || !input.trim()}
                />
              </span>
            </div>
          </div>
          {imageQueue.error && (
            <p role="alert" className="mt-2 text-xs text-destructive">
              {imageQueue.error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
