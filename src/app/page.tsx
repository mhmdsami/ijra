import { getDefaultModel, listModels, listSessionsForUser, type SessionRowWithStatus } from "@/db";
import { requireUser } from "@/lib/user";
import { projects } from "@/lib/projects";
import { ThreadsSidebar } from "@/components/threads-sidebar";
import { MobileThreads } from "@/components/mobile-threads";
import { NewRequest } from "./new-request";
import { HeaderActions } from "./header-actions";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireUser();
  const sessions = await listSessionsForUser(user.id, user.allowedProjects);
  const [modelRows, defaultModel] = await Promise.all([listModels(), getDefaultModel()]);
  const models = modelRows.map((m) => ({ id: m.id, label: m.label }));
  const projectIds = user.allowedProjects ?? projects().map((p) => p.id);

  if (projectIds.length === 0) {
    return (
      <div className="flex min-h-dvh flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <MobileThreads sessions={sessions} />
            <Link href="/" className="text-2xl italic tracking-[-0.07em]" style={{ fontFamily: "var(--font-display)" }}>ijra</Link>
          </div>
          <div className="flex items-center gap-1">
            <HeaderActions />
          </div>
        </header>
        <section className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <p className="animate-fade-up text-3xl italic leading-[0.9] tracking-[-0.06em] sm:text-4xl" style={{ fontFamily: "var(--font-display)" }}>Nothing here yet.</p>
          <p className="animate-fade-up mt-4 max-w-sm text-sm leading-6 text-muted-foreground [animation-delay:40ms]">
            You&apos;re signed in as {user.email}, but you don&apos;t have access to any projects. An admin can grant you access.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      <ThreadsSidebar sessions={sessions} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <MobileThreads sessions={sessions} />
            <Link href="/" className="text-2xl italic tracking-[-0.07em]" style={{ fontFamily: "var(--font-display)" }}>ijra</Link>
          </div>
          <div className="flex items-center gap-1">
            {user.isAdmin && <Link href="/admin" className="rounded-sm px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground">Users</Link>}
            <HeaderActions />
          </div>
        </header>

        <section className="flex min-h-0 flex-1 flex-col">
          <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-12 sm:px-8">
            <div>
              <p className="animate-fade-up text-2xl italic leading-[0.9] tracking-[-0.06em] sm:text-3xl" style={{ fontFamily: "var(--font-display)" }}>What can I fix?</p>
              <p className="animate-fade-up mt-4 max-w-md text-sm leading-6 text-muted-foreground [animation-delay:40ms]">Start with the change you need. ijra will work in your repo and open a pull request.</p>
            </div>
            <div className="animate-fade-up mt-8 [animation-delay:80ms]">
              <NewRequest projects={projectIds} models={models} defaultModel={defaultModel ?? models[0]?.id ?? ""} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
