import { notFound } from "next/navigation";
import { getDefaultModel, getMessages, getOwnerEmail, getRuns, getSession, listModels } from "@/db";
import { canAccessSession, canWriteProject, requireUser } from "@/lib/user";
import { SessionView } from "./session-view";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const session = await getSession(id);
  if (!session || !canAccessSession(user, session)) notFound();

  const [messages, runs, ownerEmail, modelRows, defaultModel] = await Promise.all([
    getMessages(id),
    getRuns(id),
    session.owner_id && session.owner_id !== user.id ? getOwnerEmail(session.owner_id) : Promise.resolve(null),
    listModels(),
    getDefaultModel(),
  ]);
  const models = modelRows.map((m) => ({ id: m.id, label: m.label, vision: m.vision === 1 }));
  const visibleRuns = user.isAdmin ? runs : runs.map((run) => ({ ...run, error_detail: null }));
  return (
    <SessionView
      key={session.id}
      initial={{
        session,
        messages,
        runs: visibleRuns,
        ownerEmail,
        isAdmin: user.isAdmin,
        viewerId: user.id,
        canWrite: canWriteProject(user, session.project),
        models,
        defaultModel: defaultModel ?? models[0]?.id ?? "",
      }}
    />
  );
}
