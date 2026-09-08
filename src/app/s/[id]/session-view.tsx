"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { HeaderActions } from "../../header-actions";
import { ThreadsSidebar } from "@/components/threads-sidebar";
import { MobileThreads } from "@/components/mobile-threads";
import { ComposerControls } from "@/components/composer-controls";
import { MODELS, MODEL_LABELS, projectConfig } from "@/lib/projects";
import { cn } from "@/lib/utils";
import type { MessageRow, RunRow, SessionRow, SessionRowWithStatus } from "@/db";

type State = { session: SessionRow; messages: MessageRow[]; runs: RunRow[]; sessions: SessionRowWithStatus[]; canWrite: boolean; canDecide: boolean };
const ACTIVE = new Set(["dispatching", "running"]);

export function SessionView({ initial }: { initial: State }) {
  const [state, setState] = useState(initial);
  const [input, setInput] = useState("");
    const [model, setModel] = useState<string>(MODELS[0]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const anyActive = state.runs.some((r) => ACTIVE.has(r.status));
  const activeRun = state.runs.find((r) => ACTIVE.has(r.status));
  const latestRun = [...state.runs].reverse().find((r) => r.pr_url && !ACTIVE.has(r.status));

  const poll = useCallback(async () => {
    const res = await fetch(`/api/sessions/${initial.session.id}`, { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as Pick<State, "messages" | "runs">;
      setState((state) => ({ ...state, ...data }));
    }
  }, [initial.session.id]);

  useEffect(() => {
    if (!anyActive) return;
    const t = setInterval(poll, 4000);
    return () => clearInterval(t);
  }, [anyActive, poll]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [state.messages.length]);

  async function send() {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setSendError(null);
    setInput("");
    setState((s) => ({
      ...s,
      messages: [...s.messages, { id: -Date.now(), session_id: s.session.id, role: "user", content, meta: null, created_at: Date.now() }],
      runs: [...s.runs, { id: "pending", session_id: s.session.id, project: s.session.project, request: content, model, mode: initial.canWrite ? "auto" : "ask", status: "dispatching", gh_run_id: null, gh_run_url: null, pr_url: null, branch: null, safe_zone: null, agent_msg: 0, dispatch_at: Date.now(), updated_at: Date.now(), requested_by: null, policy_status: "pending", policy_reasons: null, decision: null, decided_by: null, decided_at: null, decision_reason: null }],
    }));
    try {
      const res = await fetch(`/api/sessions/${initial.session.id}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content, model }),
      });
      if (res.ok) {
        const data = (await res.json()) as Pick<State, "messages" | "runs">;
        setState((state) => ({ ...state, ...data }));
      } else {
        const body = await res.json().catch(() => null) as { error?: string } | null;
        setInput(content);
        setSendError(body?.error ?? "Unable to send request.");
      }
    } catch {
      setInput(content);
      setSendError("Unable to send request. Check your connection and try again.");
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

  async function deleteThread() {
    if (!confirm("Delete this thread?")) return;
    await fetch(`/api/sessions/${initial.session.id}`, { method: "DELETE" });
    router.push("/");
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      <ThreadsSidebar sessions={state.sessions} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b px-4 sm:px-6">
          <Link href="/" className="text-2xl italic tracking-[-0.07em]" style={{ fontFamily: "var(--font-display)" }}>ijra</Link>
          <div className="flex items-center gap-2">
            <MobileThreads sessions={state.sessions} />
            <Link
              href={`https://github.com/${projectConfig(state.session.project).repo}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-foreground/15 px-2.5 py-0.5 text-[10px] tracking-wide text-muted-foreground transition-colors hover:text-foreground"
            >
              {state.session.project}
            </Link>
            <Button onClick={deleteThread} variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" aria-label="Delete thread">
              <Trash2 className="size-3.5" />
            </Button>
            <HeaderActions />
          </div>
        </header>

        <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col px-6 sm:px-10">
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto py-8 sm:py-12">
            {state.messages.length === 0 && (
              <div className="flex flex-1 flex-col justify-center">
                <p className="text-[11px] uppercase tracking-[0.14em] text-primary">New request</p>
                <h1 className="mt-3 text-2xl tracking-[-0.04em]">Describe the change.</h1>
                <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">The agent will make the change and open a pull request.</p>
              </div>
            )}
            {state.messages.map((m) => <Message key={m.id} role={m.role} content={m.content} />)}
            {anyActive && <StatusLine runs={state.runs} onCancel={cancelRun} />}
            {!anyActive && <PrCard run={latestRun} canDecide={initial.canDecide} onMerged={(runs) => setState((s) => ({ ...s, runs }))} />}
            <div ref={bottomRef} />
          </div>

          <div className="shrink-0 pb-4 pt-2 sm:pb-5">
            {sendError && <p role="alert" className="mb-2 text-xs text-destructive">{sendError}</p>}
            <div className="flex items-end gap-3 rounded-xl border bg-card p-3 focus-within:border-primary/60">
              <Textarea value={input} onChange={(e) => { setInput(e.target.value); setSendError(null); }} onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
              }} placeholder="Ask a question or describe a change" rows={2} className="min-h-12 flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent" />
            </div>
            <p className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
              <span>Enter to send</span>
              <span className="ml-auto">
                <ComposerControls
                  model={model}
                  onModel={setModel}
                  onSend={send}
                  busy={sending}
                  disabled={!input.trim()}
                />
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Message({ role, content }: { role: string; content: string }) {
  const isUser = role === "user";
  return (
    <article className="animate-fade-up border-l border-border pl-4">
      <p className={cn("mb-2 text-[10px] uppercase tracking-[0.14em]", isUser ? "text-primary" : "text-muted-foreground")}>{isUser ? "You" : "ijra"}</p>
      {isUser ? (
        <div className="max-w-3xl whitespace-pre-wrap text-sm leading-6">{content}</div>
      ) : (
        <Markdown text={content} />
      )}
    </article>
  );
}

function Markdown({ text }: { text: string }) {
  return (
    <div className="max-w-3xl space-y-3 text-sm leading-6 [&_a]:break-all [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_code]:rounded-sm [&_code]:bg-secondary [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px] [&_h1,h2,h3]:text-base [&_h1,h2,h3]:font-semibold [&_li]:ml-4 [&_ol]:list-decimal [&_p]:m-0 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-secondary [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_strong]:font-semibold [&_ul]:list-disc">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

function StatusLine({ runs, onCancel }: { runs: RunRow[]; onCancel: () => void }) {
  const latest = runs.at(-1);
  if (!latest) return null;
  const label = latest.status === "dispatching" ? "Dispatching request" : latest.status === "running" ? "Agent is working" : null;
  if (!label) return null;
  return (
    <div className="animate-fade-up flex items-center gap-2 text-xs text-primary">
      <span className="size-1.5 animate-pulse rounded-full bg-primary" />
      {label}
      <button onClick={onCancel} className="ml-1 text-muted-foreground underline underline-offset-4 hover:text-foreground">
        cancel
      </button>
    </div>
  );
}

function PrCard({
  run,
  canDecide,
  onMerged,
}: {
  run: RunRow | undefined;
  canDecide: boolean;
  onMerged: (runs: RunRow[]) => void;
}) {
  const [merging, setMerging] = useState(false);
  if (!run || !run.pr_url) return null;

  const label =
    run.status === "awaiting_review" ? "Awaiting review"
    : run.status === "merged" ? "Merged"
    : run.status === "failed" ? "Failed"
    : run.status;
  const tone =
    run.status === "awaiting_review" ? "text-primary"
    : run.status === "merged" ? "text-[#71c98e]"
    : "text-muted-foreground";

  const sessionId = run?.session_id ?? "";

  async function merge() {
    setMerging(true);
    const res = await fetch(`/api/sessions/${sessionId}/merge`, { method: "POST" });
    if (res.ok) onMerged(((await res.json()) as { runs: RunRow[] }).runs);
    setMerging(false);
  }

  let reasons: string[] = [];
  try { reasons = run.policy_reasons ? JSON.parse(run.policy_reasons) : []; } catch {}

  return (
    <div className="animate-fade-up flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
      <Badge variant="outline" className={cn("shrink-0 border-foreground/15 text-[10px] uppercase tracking-wide", tone)}>{label}</Badge>
      <a href={run.pr_url} target="_blank" rel="noreferrer" className="min-w-0 truncate text-xs underline underline-offset-4 hover:text-foreground">
        {run.pr_url.replace(/^https:\/\/github\.com\//, "")}
      </a>
      {run.branch && <span className="hidden shrink-0 text-[10px] text-muted-foreground sm:inline">{run.branch}</span>}
      <span className="ml-auto shrink-0">
        {run.status === "awaiting_review" && canDecide ? (
          <button onClick={merge} disabled={merging} className="rounded-full border border-foreground/25 px-3 py-1 text-[10px] uppercase tracking-wide transition-colors hover:bg-secondary disabled:opacity-40">
            {merging ? "merging…" : "merge"}
          </button>
        ) : reasons.length > 0 ? (
          <span className="text-[10px] text-muted-foreground">{reasons[0]}</span>
        ) : null}
      </span>
    </div>
  );
}
