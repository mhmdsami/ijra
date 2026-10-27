import { FolderLock } from "lucide-react";
import Link from "next/link";
import { HeaderActions } from "@/app/header-actions";
import { EmptyState } from "@/components/empty-state";
import { MobileThreads } from "@/components/mobile-threads";
import { Wordmark } from "@/components/wordmark";
import { getDefaultModel, listModels } from "@/db";
import { projects } from "@/lib/projects";
import { requireUser } from "@/lib/user";
import { NewRequest } from "./new-request";

export default async function Home() {
  const user = await requireUser();
  const [modelRows, defaultModel] = await Promise.all([listModels(), getDefaultModel()]);
  const models = modelRows.map((m) => ({ id: m.id, label: m.label, vision: m.vision === 1 }));
  const projectIds = user.allowedProjects ?? projects().map((p) => p.id);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <MobileThreads />
          <Link href="/" aria-label="ijra home" className="rounded-sm">
            <Wordmark />
          </Link>
        </div>
        <div className="flex items-center gap-1">
          {user.isAdmin && (
            <Link
              href="/admin"
              className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              Admin
            </Link>
          )}
          <HeaderActions />
        </div>
      </header>

      <section className="flex min-h-0 flex-1 flex-col">
        {projectIds.length === 0 ? (
          <EmptyState
            icon={FolderLock}
            title="No projects yet."
            description={`You're signed in as ${user.email}. An admin can grant you access to a project.`}
            className="animate-fade-up flex-1 justify-center"
          />
        ) : (
          <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-12 sm:px-6">
            <div>
              <h1 className="type-display animate-fade-up text-3xl leading-[1.02] sm:text-4xl">What can I fix?</h1>
              <p className="animate-fade-up mt-4 max-w-xl text-sm leading-6 text-pretty text-muted-foreground [animation-delay:40ms]">
                Describe the change, ijra will work in the repo and open a pull request.
              </p>
            </div>
            <div className="animate-fade-up mt-8 [animation-delay:80ms]">
              <NewRequest projects={projectIds} models={models} defaultModel={defaultModel ?? models[0]?.id ?? ""} />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
