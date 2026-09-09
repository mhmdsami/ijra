"use client";

import { useState } from "react";
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
          className="h-8 w-full rounded-md border border-border bg-card px-2.5 text-xs outline-none focus:border-primary/60"
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
      {users.length > 0 && filtered.length === 0 && <p className="text-xs text-muted-foreground">No users match.</p>}
      {users.length === 0 && <p className="text-xs text-muted-foreground">New sign-ins will appear here.</p>}
    </>
  );
}
