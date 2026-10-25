"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { UserCard, type AdminUser } from "./user-card";

export function UserList({
  users,
  meId,
  allProjects,
  superAdminId,
  defaultLimit,
}: {
  users: AdminUser[];
  meId: string;
  allProjects: string[];
  superAdminId: string | undefined;
  defaultLimit: number;
}) {
  const [q, setQ] = useState("");
  const filtered = users.filter((u) => u.email.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <>
      {users.length > 3 && (
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by email"
          aria-label="Search users by email"
          className="h-8 w-full rounded-md border bg-card px-2.5 text-sm outline-none placeholder:text-text-tertiary focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        />
      )}
      {filtered.map((user) => (
        <UserCard
          key={user.id}
          user={user}
          meId={meId}
          allProjects={allProjects}
          defaultLimit={defaultLimit}
          locked={user.id === superAdminId}
          viewerIsSuperAdmin={meId === superAdminId}
        />
      ))}
      {users.length > 0 && filtered.length === 0 && (
        <EmptyState
          variant="inline"
          title="No users match."
          action={
            <button onClick={() => setQ("")} className="rounded-md border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground">
              Clear search
            </button>
          }
        />
      )}
      {users.length === 0 && (
        <div className="rounded-lg border bg-card">
          <EmptyState
            icon={Users}
            title="No users yet."
            description="New sign-ins appear here. Grant access once someone signs in."
            className="py-12"
          />
        </div>
      )}
    </>
  );
}
