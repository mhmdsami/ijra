"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function HeaderActions() {
  const [busy, setBusy] = useState(false);

  async function signOut() {
    if (busy) return;
    setBusy(true);
    const { error } = await authClient.signOut();
    if (error) {
      setBusy(false);
      return;
    }
    window.location.assign("/login");
  }

  return (
    <Button variant="ghost" size="sm" type="button" onClick={signOut} disabled={busy} className="px-2 text-xs text-foreground/80 hover:bg-foreground/5">
      <LogOut />
      {busy ? "Signing out" : "Sign out"}
    </Button>
  );
}
