import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { guardAdmin, usersWithGrants } from "./actions";
import { UserList } from "./user-list";
import { DEFAULT_DAILY_LIMIT, getSuperAdminId } from "@/db";
import { projects } from "@/lib/projects";
import { HeaderActions } from "../header-actions";

export const dynamic = "force-dynamic";
const ALL_PROJECTS = projects().map((project) => project.id);

export default async function AdminPage() {
  const [admin, users] = await Promise.all([guardAdmin(), usersWithGrants()]);
  const superAdminId = [...users].filter((u) => u.role === "admin").sort((a, b) => a.createdAt - b.createdAt)[0]?.id;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span className="text-2xl italic tracking-[-0.07em] text-foreground" style={{ fontFamily: "var(--font-display)" }}>ijra</span>
        </Link>
        <div className="flex items-center gap-1">
          {admin.isAdmin && <Link href="/admin" className="rounded-sm px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground">Users</Link>}
          <HeaderActions />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-1">
          <h1 className="text-lg text-foreground">Access</h1>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Admins see everything. Others get per-project access: <b>ask</b> is questions only, <b>write</b> lets the agent open pull requests.
          </p>
        </div>

        <UserList
          users={users}
          meId={admin.id}
          allProjects={ALL_PROJECTS}
          defaultLimit={DEFAULT_DAILY_LIMIT}
          superAdminId={superAdminId}
        />
      </div>
    </div>
  );
}
