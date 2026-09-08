import { getMessages, getRuns, getSession, listSessionsForUser } from "@/db";
import { canAccessSession, canWriteProject, requireUser } from "@/lib/user";
import { notFound } from "next/navigation";
import { SessionView } from "./session-view";

export const dynamic = "force-dynamic";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const session = await getSession(id);
  if (!session || !canAccessSession(user, session)) notFound();

  const [messages, runs, sessions] = await Promise.all([
    getMessages(id),
    getRuns(id),
    listSessionsForUser(user.id, user.allowedProjects),
  ]);
  return (
    <SessionView
      initial={{
        session,
        messages,
        runs,
        sessions,
        canWrite: canWriteProject(user, session.project),
        canDecide: user.isAdmin || session.owner_id === user.id,
      }}
    />
  );
}
