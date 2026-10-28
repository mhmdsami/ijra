import type { ReactNode } from "react";
import { SessionsProvider } from "@/components/sessions-context";
import { ThreadsSidebar } from "@/components/threads-sidebar";
import { listSessionsForUser } from "@/db";
import { projects } from "@/lib/projects";
import { SESSIONS_PAGE_SIZE } from "@/lib/session-list";
import { requireUser } from "@/lib/user";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const { sessions, hasMore } = await listSessionsForUser(user.id, user.allowedProjects, {
    limit: SESSIONS_PAGE_SIZE,
  });
  const projectIds = user.allowedProjects ?? projects().map((project) => project.id);
  return (
    <SessionsProvider sessions={sessions} initialHasMore={hasMore} viewerId={user.id} projects={projectIds}>
      <div className="flex h-dvh overflow-hidden">
        <ThreadsSidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </SessionsProvider>
  );
}
