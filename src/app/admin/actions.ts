"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth-server";
import {
  DEFAULT_DAILY_LIMIT,
  deleteUserRow,
  getSuperAdminId,
  getUserLimits,
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
  const desiredLimits = new Map<string, number>();
  for (const raw of formData.getAll("limit").map(String)) {
    const i = raw.lastIndexOf(":");
    const model = raw.slice(0, i);
    const n = Number.parseInt(raw.slice(i + 1), 10);
    if ((MODELS as readonly string[]).includes(model) && Number.isInteger(n) && n > 0 && n <= 1000) desiredLimits.set(model, n);
  }
  const currentLimits = await getUserLimits(userId);
  for (const [model, n] of desiredLimits) {
    if (currentLimits.find((l) => l.model === model)?.daily_limit !== n) await setUserLimit(userId, model, n);
  }
  for (const { model } of currentLimits) if (!desiredLimits.has(model)) await removeUserLimit(userId, model);
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
  return Promise.all(users.map(async (u) => ({ ...u, projects: await getUserProjects(u.id), limits: await getUserLimits(u.id) })));
}
