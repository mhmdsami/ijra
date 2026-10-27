"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function HeaderActions() {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signOut() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const { error } = await authClient.signOut();
      if (error) {
        setBusy(false);
        setFailed(true);
        return;
      }
      window.location.assign("/login");
    } catch {
      setBusy(false);
      setFailed(true);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      type="button"
      onClick={signOut}
      disabled={busy}
      className="px-2 text-xs text-muted-foreground hover:text-foreground"
      aria-label={failed ? "Sign out failed, retry" : "Sign out"}
      title={failed ? "Sign out failed. Try again." : undefined}
    >
      <LogOut />
      <span className="hidden sm:inline">{busy ? "Signing out" : failed ? "Retry sign out" : "Sign out"}</span>
      {failed && (
        <span role="alert" className="sr-only">
          Sign out failed. Try again.
        </span>
      )}
    </Button>
  );
}
