"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { deleteUserAction, saveAccessAction, setAdminAction } from "./actions";
import { cn } from "@/lib/utils";

export type Grant = { project: string; canWrite: boolean };
export type AdminUser = { id: string; email: string; role: string | null; projects: Grant[]; limit: number | null };

export function UserCard({
  user,
  meId,
  allProjects,
  defaultLimit,
  locked = false,
  viewerIsSuperAdmin = false,
}: {
  user: AdminUser;
  meId: string;
  allProjects: string[];
  defaultLimit: number;
  locked?: boolean;
  viewerIsSuperAdmin?: boolean;
}) {
  const isAdmin = user.role === "admin";
  const isMe = user.id === meId;
  const canChangeRole = viewerIsSuperAdmin && !isMe;
  const canDelete = viewerIsSuperAdmin && !isMe;
  const initial = Object.fromEntries(user.projects.map((g) => [g.project, g.canWrite ? "write" : "ask"] as const));
  const [draft, setDraft] = useState<Record<string, "ask" | "write">>(initial);
  const [draftLimit, setDraftLimit] = useState<string>(user.limit === null ? "" : String(user.limit));
  const [pending, startTransition] = useTransition();
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial) || draftLimit !== (user.limit === null ? "" : String(user.limit));

  useEffect(() => {
    setDraft(Object.fromEntries(user.projects.map((g) => [g.project, g.canWrite ? "write" : "ask"] as const)));
    setDraftLimit(user.limit === null ? "" : String(user.limit));
  }, [user.projects, user.limit]);

  function save() {
    const form = document.getElementById(`access-${user.id}`) as HTMLFormElement;
    startTransition(() => form.requestSubmit());
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-xs font-medium">
          {user.email}
          {isMe && <span className="ml-2 text-[10px] text-muted-foreground">you</span>}
        </span>
        {!isAdmin && !isMe && (
          <div className="flex shrink-0 items-center gap-2">
            {canChangeRole && (
              <form action={setAdminAction}>
                <input type="hidden" name="userId" value={user.id} />
                <input type="hidden" name="admin" value="on" />
                <button type="submit" className="text-[10px] uppercase tracking-wide text-muted-foreground hover:text-foreground">
                  make admin
                </button>
              </form>
            )}
            {canDelete && (
              <form action={deleteUserAction}>
                <input type="hidden" name="userId" value={user.id} />
                <button type="submit" className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-destructive" aria-label={`Delete ${user.email}`}>
                  <Trash2 className="size-3.5" />
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {locked ? (
        <p className="mt-2 text-[11px] text-muted-foreground">Admin: full access to all projects.</p>
      ) : isAdmin ? (
        <p className="mt-2 text-[11px] text-muted-foreground">Admin: full access to all projects.</p>
      ) : (
        <form id={`access-${user.id}`} action={saveAccessAction} className="mt-3 flex flex-col gap-1.5">
          <input type="hidden" name="userId" value={user.id} />
          {Object.entries(draft).map(([project, level]) => (
            <input key={project} type="hidden" name="grant" value={`${project}:${level}`} />
          ))}
          <input type="hidden" name="limit" value={draftLimit.trim()} />
          {Object.entries(draft).map(([project, level]) => (
            <div key={project} className="flex items-center justify-between gap-3 rounded-lg bg-secondary/50 px-2.5 py-1.5">
              <span className="text-xs">{project}</span>
              <div className="flex items-center gap-1">
                {(["ask", "write"] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, [project]: l }))}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wide transition-colors",
                      level === l ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                    )}
                    title={l === "ask" ? "Questions only" : "Can open pull requests"}
                  >
                    {l}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setDraft((d) => { const { [project]: _, ...rest } = d; return rest; })}
                  className="ml-1 text-muted-foreground transition-colors hover:text-destructive"
                  aria-label={`Remove ${project}`}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
          {allProjects.filter((p) => !(p in draft)).length > 0 && (
            <select
              value=""
              onChange={(e) => e.target.value && setDraft((d) => ({ ...d, [e.target.value]: "ask" }))}
              className="h-7 self-start rounded-md border border-border bg-card px-2 text-xs text-muted-foreground outline-none"
              aria-label="Add project"
            >
              <option value="">Add project</option>
              {allProjects.filter((p) => !(p in draft)).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          )}
          <label className="flex items-center gap-2 pt-1">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">daily limit</span>
            <input
              type="number"
              min={1}
              max={1000}
              value={draftLimit}
              onChange={(e) => setDraftLimit(e.target.value)}
              placeholder={String(defaultLimit)}
              className="h-6 w-14 rounded-md border border-border bg-card px-1 text-center text-[11px] outline-none focus:border-primary/60"
            />
            <span className="text-[10px] text-muted-foreground">requests / day, blank = {defaultLimit}</span>
          </label>
          {Object.keys(draft).length === 0 && allProjects.length === 0 && (
            <p className="text-[11px] text-muted-foreground">No projects configured.</p>
          )}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={!dirty || pending}
              className="rounded-full bg-foreground px-3 py-1 text-[10px] uppercase tracking-wide text-background transition-opacity disabled:opacity-30"
            >
              {pending ? "saving…" : "save"}
            </button>
            <button
              type="button"
              onClick={() => setDraft(initial)}
              disabled={!dirty || pending}
              className="rounded-full border border-border px-3 py-1 text-[10px] uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
            >
              reset
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
