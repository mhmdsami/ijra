import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AdminNav } from "@/components/admin-nav";
import { Button } from "@/components/ui/button";
import { listAuditEvents, listRecentRuns, listUsers } from "@/db";
import { projects } from "@/lib/projects";
import { HeaderActions } from "../../header-actions";
import { guardAdmin } from "../actions";

export const dynamic = "force-dynamic";

function when(timestamp: number | null) {
  if (!timestamp) return "—";
  return new Date(timestamp).toISOString().replace("T", " ").slice(0, 16);
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; actor?: string }>;
}) {
  await guardAdmin();
  const params = await searchParams;
  const projectIds = projects().map((project) => project.id);
  const project = params.project && projectIds.includes(params.project) ? params.project : null;
  const users = await listUsers();
  const actorId = params.actor && users.some((user) => user.id === params.actor) ? params.actor : null;
  const [runs, events] = await Promise.all([
    listRecentRuns({ limit: 50, project, actorId }),
    listAuditEvents({ limit: 50, project, actorId }),
  ]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-4 sm:px-6">
        <Link
          href="/"
          className="group flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span className="type-display text-2xl leading-none text-foreground">ijra</span>
        </Link>
        <div className="flex items-center gap-2">
          <AdminNav />
          <HeaderActions />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <div>
          <h1 className="text-xl font-medium tracking-[-0.01em] text-foreground">Audit</h1>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
            The most recent 50 runs and audit events. Audit events are append-only and keep admin metadata only.
          </p>
        </div>

        <form className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-2xs text-text-tertiary">
            Project
            <select
              name="project"
              defaultValue={project ?? ""}
              className="h-7 rounded-md border bg-transparent px-2 text-xs text-foreground"
            >
              <option value="">All projects</option>
              {projectIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-2xs text-text-tertiary">
            User
            <select
              name="actor"
              defaultValue={actorId ?? ""}
              className="h-7 max-w-52 rounded-md border bg-transparent px-2 text-xs text-foreground"
            >
              <option value="">Everyone</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.email}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" size="xs" variant="outline">
            Filter
          </Button>
          <Link
            href="/admin/audit"
            className="px-1 py-1.5 text-2xs text-text-tertiary underline underline-offset-4 hover:text-foreground"
          >
            Reset
          </Link>
        </form>

        <section className="flex flex-col gap-2">
          <h2 className="type-label text-text-tertiary">Runs</h2>
          {runs.length === 0 ? (
            <p className="text-xs text-text-tertiary">No runs match this filter.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full min-w-[42rem] text-left text-xs">
                <thead className="border-b text-2xs text-text-tertiary">
                  <tr>
                    <th className="px-3 py-2 font-medium">Dispatched</th>
                    <th className="px-3 py-2 font-medium">Project</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Model</th>
                    <th className="px-3 py-2 font-medium">Requester</th>
                    <th className="px-3 py-2 font-medium">Decision</th>
                    <th className="px-3 py-2 font-medium">Links</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id} className="border-b last:border-0">
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-2xs text-text-tertiary">
                        {when(run.dispatch_at)}
                      </td>
                      <td className="px-3 py-2">{run.project}</td>
                      <td className="px-3 py-2 font-mono text-2xs">{run.status}</td>
                      <td className="px-3 py-2 font-mono text-2xs">{run.model}</td>
                      <td className="px-3 py-2 text-2xs text-text-secondary">{run.requester_email ?? "—"}</td>
                      <td className="px-3 py-2 text-2xs text-text-secondary">
                        {run.decision ?? "—"}
                        {run.decision_reason ? `: ${run.decision_reason}` : ""}
                        {run.decider_email && <span className="ml-1 text-text-tertiary">({run.decider_email})</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-2xs">
                        <Link
                          href={`/s/${run.session_id}`}
                          className="underline underline-offset-4 hover:text-foreground"
                        >
                          session
                        </Link>
                        {run.pr_url && (
                          <>
                            {" "}
                            ·{" "}
                            <a
                              href={run.pr_url}
                              target="_blank"
                              rel="noreferrer"
                              className="underline underline-offset-4 hover:text-foreground"
                            >
                              pr
                            </a>
                          </>
                        )}
                        {run.gh_run_url && (
                          <>
                            {" "}
                            ·{" "}
                            <a
                              href={run.gh_run_url}
                              target="_blank"
                              rel="noreferrer"
                              className="underline underline-offset-4 hover:text-foreground"
                            >
                              run
                            </a>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="type-label text-text-tertiary">Audit events</h2>
          {events.length === 0 ? (
            <p className="text-xs text-text-tertiary">No audit events match this filter.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full min-w-[34rem] text-left text-xs">
                <thead className="border-b text-2xs text-text-tertiary">
                  <tr>
                    <th className="px-3 py-2 font-medium">When</th>
                    <th className="px-3 py-2 font-medium">Action</th>
                    <th className="px-3 py-2 font-medium">Actor</th>
                    <th className="px-3 py-2 font-medium">Project</th>
                    <th className="px-3 py-2 font-medium">Session</th>
                    <th className="px-3 py-2 font-medium">Metadata</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={event.id} className="border-b last:border-0">
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-2xs text-text-tertiary">
                        {when(event.created_at)}
                      </td>
                      <td className="px-3 py-2 font-mono text-2xs">{event.action}</td>
                      <td className="px-3 py-2 text-2xs text-text-secondary">{event.actor_email ?? "system"}</td>
                      <td className="px-3 py-2 text-2xs text-text-secondary">{event.project ?? "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-2xs">
                        <Link
                          href={`/s/${event.session_id}`}
                          className="font-mono underline underline-offset-4 hover:text-foreground"
                        >
                          {event.session_id.slice(0, 8)}
                        </Link>
                      </td>
                      <td
                        className="max-w-64 truncate px-3 py-2 font-mono text-2xs text-text-tertiary"
                        title={event.metadata ?? ""}
                      >
                        {event.metadata ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
