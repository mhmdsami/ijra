import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth-server";
import { adminCount, getUserProjects, promoteToAdmin, type SessionRow } from "@/db";
import { projects } from "./projects";

function isLocalPreview() {
  try {
    return !!(getCloudflareContext().env as Record<string, string>).BETTER_AUTH_URL?.startsWith("http://localhost");
  } catch {
    return false;
  }
}

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  allowedProjects: string[] | null;
  writeProjects: string[] | null;
}

export async function requireUser(): Promise<CurrentUser> {
  if (isLocalPreview()) {
    return { id: "dev-local", email: "dev@localhost", name: "Local", isAdmin: true, allowedProjects: null, writeProjects: null };
  }
  const session = await auth().api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");
  let isAdmin = session.user.role === "admin";
  if (!isAdmin && (await adminCount()) === 0) {
    await promoteToAdmin(session.user.id);
    isAdmin = true;
  }
  const grants = isAdmin ? null : await projectGrants(session.user.id);
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    isAdmin,
    allowedProjects: grants?.map((g) => g.project) ?? null,
    writeProjects: grants?.filter((g) => g.canWrite).map((g) => g.project) ?? null,
  };
}

async function projectGrants(userId: string) {
  const granted = await getUserProjects(userId);
  const known = projects().map((p) => p.id);
  return granted.filter((g) => known.includes(g.project));
}

export function canAccessProject(user: CurrentUser, project: string) {
  return user.allowedProjects === null || user.allowedProjects.includes(project);
}

export function canWriteProject(user: CurrentUser, project: string) {
  return user.writeProjects === null || user.writeProjects.includes(project);
}

export function canAccessSession(user: CurrentUser, session: SessionRow) {
  return user.isAdmin || (session.owner_id === user.id && canAccessProject(user, session.project));
}
