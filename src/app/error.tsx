"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="type-display text-4xl leading-[1.02]">Something broke.</p>
      <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">The request failed. Try again, and if it keeps failing check the run logs.</p>
      <div className="mt-6 flex items-center gap-2">
        <button onClick={reset} className="rounded-md border px-3 py-1.5 text-xs transition-colors hover:bg-surface-2">Try again</button>
        <Link href="/" className="rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground">Back to ijra</Link>
      </div>
    </div>
  );
}
