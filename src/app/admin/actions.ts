"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth-server";
import {
  DEFAULT_DAILY_LIMIT,
  deleteUserRow,
  getSuperAdminId,
  getUserLimit,
  getUserProjects,
  listUsers,
  removeUserLimit,
  removeUserProject,
  setUserLimit,
  setUserProject,
} from "@/db";
import { requireUser } from "@/lib/user";
import { MODELS, projects } from "@/lib/projects";

export async function saveAccessAction(formData: FormData) {
  const admin = await requireUser();
  if (!admin.isAdmin) return;
  const userId = String(formData.get("userId"));
  if (await isLockedTarget(admin.id, userId)) return;
  const known = new Set(projects().map((p) => p.id));
  const desired = new Map<string, "ask" | "write">();
  for (const raw of formData.getAll("grant").map(String)) {
    const i = raw.lastIndexOf(":");
    const project = raw.slice(0, i);
    const level = raw.slice(i + 1);
    if (known.has(project) && (level === "ask" || level === "write")) desired.set(project, level);
  }
  const current = await getUserProjects(userId);
  for (const [project, level] of desired) await setUserProject(userId, project, level === "write");
  for (const { project } of current) if (!desired.has(project)) await removeUserProject(userId, project);
  const rawLimit = String(formData.get("limit") ?? "").trim();
  if (rawLimit === "") await removeUserLimit(userId);
  else {
    const n = Number.parseInt(rawLimit, 10);
    if (Number.isInteger(n) && n > 0 && n <= 1000) await setUserLimit(userId, n);
  }
  revalidatePath("/admin");
}

export async function setAdminAction(formData: FormData) {
  const admin = await requireUser();
  if (!admin.isAdmin || admin.id !== (await getSuperAdminId())) return;
  const userId = String(formData.get("userId"));
  const makeAdmin = formData.get("admin") === "on";
  if (userId === admin.id) return;
  await auth().api.setRole({ headers: await headers(), body: { userId, role: makeAdmin ? "admin" : "user" } });
  revalidatePath("/admin");
}

export async function deleteUserAction(formData: FormData) {
  const admin = await requireUser();
  if (!admin.isAdmin || admin.id !== (await getSuperAdminId())) return;
  const userId = String(formData.get("userId"));
  if (userId === admin.id) return;
  await deleteUserRow(userId);
  revalidatePath("/admin");
}

async function isLockedTarget(actorId: string, targetId: string) {
  if (actorId === targetId) return true;
  const target = (await listUsers()).find((u) => u.id === targetId);
  if (target?.role !== "admin") return false;
  return actorId !== (await getSuperAdminId());
}

export async function guardAdmin() {
  const user = await requireUser();
  if (!user.isAdmin) redirect("/");
  return user;
}

export async function usersWithGrants() {
  const users = await listUsers();
  return Promise.all(users.map(async (u) => ({ ...u, projects: await getUserProjects(u.id), limit: await getUserLimit(u.id) })));
}
