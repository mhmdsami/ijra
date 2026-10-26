import type { SessionRow } from "@/db";

export interface AccessUser {
  id: string;
  isAdmin: boolean;
  allowedProjects: string[] | null;
  writeProjects: string[] | null;
}

export function canAccessProject(user: AccessUser, project: string) {
  return user.allowedProjects === null || user.allowedProjects.includes(project);
}

export function canWriteProject(user: AccessUser, project: string) {
  return user.writeProjects === null || user.writeProjects.includes(project);
}

export function canAccessSession(user: AccessUser, session: Pick<SessionRow, "owner_id" | "project">) {
  return user.isAdmin || (session.owner_id === user.id && canAccessProject(user, session.project));
}

export function canReviewRun(user: AccessUser) {
  return user.isAdmin;
}
