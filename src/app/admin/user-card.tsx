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
  const limitStored = user.limit === null ? "" : String(user.limit);
  const limitInvalid = draftLimit.trim() !== "" && (!/^\d+$/.test(draftLimit.trim()) || Number(draftLimit) < 1 || Number(draftLimit) > 1000);
  const dirty = (JSON.stringify(draft) !== JSON.stringify(initial) || draftLimit !== limitStored) && !limitInvalid;

  useEffect(() => {
    setDraft(Object.fromEntries(user.projects.map((g) => [g.project, g.canWrite ? "write" : "ask"] as const)));
    setDraftLimit(user.limit === null ? "" : String(user.limit));
  }, [user.projects, user.limit]);

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-sm font-medium">
          {user.email}
          {isMe && <span className="ml-2 text-2xs font-normal text-text-tertiary">you</span>}
        </span>
        {!isAdmin && !isMe && (
          <div className="flex shrink-0 items-center gap-1">
            {canChangeRole && (
              <form action={setAdminAction}>
                <input type="hidden" name="userId" value={user.id} />
                <input type="hidden" name="admin" value="on" />
                <button type="submit" className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground">
                  Make admin
                </button>
              </form>
            )}
            {canDelete && (
              <form action={deleteUserAction}>
                <input type="hidden" name="userId" value={user.id} />
                <button type="submit" className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-destructive" aria-label={`Delete ${user.email}`}>
                  <Trash2 className="size-3.5" />
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {locked ? (
        <p className="mt-2 text-xs text-text-tertiary">Admin: full access to all projects.</p>
      ) : isAdmin ? (
        <p className="mt-2 text-xs text-text-tertiary">Admin: full access to all projects.</p>
      ) : (
        <form id={`access-${user.id}`} action={saveAccessAction} className="mt-3 flex flex-col gap-1.5">
          <input type="hidden" name="userId" value={user.id} />
          {Object.entries(draft).map(([project, level]) => (
            <input key={project} type="hidden" name="grant" value={`${project}:${level}`} />
          ))}
          <input type="hidden" name="limit" value={draftLimit.trim()} />
          {Object.entries(draft).map(([project, level]) => (
            <div key={project} className="flex items-center justify-between gap-3 rounded-md bg-surface-2/50 px-2.5 py-1.5">
              <span className="truncate text-xs">{project}</span>
              <div className="flex shrink-0 items-center gap-1">
                <span className="flex items-center gap-0.5 rounded-md bg-background/40 p-0.5">
                  {(["ask", "write"] as const).map((l) => (
                    <button
                      key={l}
                      type="button"
                      aria-pressed={level === l}
                      onClick={() => setDraft((d) => ({ ...d, [project]: l }))}
                      className={cn(
                        "rounded-sm px-2 py-0.5 text-2xs transition-colors",
                        level === l ? "bg-surface-3 text-foreground" : "text-text-tertiary hover:text-foreground"
                      )}
                      title={l === "ask" ? "Questions only" : "Can open pull requests"}
                    >
                      {l}
                    </button>
                  ))}
                </span>
                <button
                  type="button"
                  onClick={() => setDraft((d) => { const { [project]: _, ...rest } = d; return rest; })}
                  className="ml-0.5 rounded-sm px-1 text-muted-foreground transition-colors hover:text-destructive"
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
              className="h-7 self-start rounded-md border bg-card px-2 text-xs text-muted-foreground outline-none focus-visible:border-ring"
              aria-label="Add project"
            >
              <option value="">Add project</option>
              {allProjects.filter((p) => !(p in draft)).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          )}
          <label className="flex items-center gap-2 pt-1" title={limitInvalid ? "daily limit must be 1 to 1000" : undefined}>
            <span className={cn("text-2xs tracking-[0.06em] uppercase", limitInvalid ? "text-destructive" : "text-text-tertiary")}>daily limit</span>
            <input
              type="number"
              min={1}
              max={1000}
              value={draftLimit}
              onChange={(e) => setDraftLimit(e.target.value)}
              placeholder={String(defaultLimit)}
              className="h-6 w-14 rounded-sm border bg-card px-1 text-center text-xs outline-none focus-visible:border-ring"
            />
            <span className="text-2xs text-text-tertiary">requests / day, blank = {defaultLimit}</span>
          </label>
          {Object.keys(draft).length === 0 && allProjects.length === 0 && (
            <p className="text-xs text-text-tertiary">No projects configured.</p>
          )}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={!dirty || pending}
              className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-40"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => { setDraft(initial); setDraftLimit(limitStored); }}
              disabled={!dirty || pending}
              className="rounded-md border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-40"
            >
              Reset
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
