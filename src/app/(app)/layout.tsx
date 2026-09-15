import type { ReactNode } from "react";
import { listSessionsForUser } from "@/db";
import { requireUser } from "@/lib/user";
import { ThreadsSidebar } from "@/components/threads-sidebar";
import { SessionsProvider } from "@/components/sessions-context";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const sessions = await listSessionsForUser(user.id, user.allowedProjects);
  return (
    <SessionsProvider sessions={sessions} showOwner={sessions.some((s) => s.owner_id !== user.id)}>
      <div className="flex h-dvh overflow-hidden">
        <ThreadsSidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </SessionsProvider>
  );
}
