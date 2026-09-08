"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="text-4xl italic leading-[0.9] tracking-[-0.06em]" style={{ fontFamily: "var(--font-display)" }}>Something broke.</p>
      <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">The request failed. Try again, and if it keeps failing check the run logs.</p>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={reset} className="rounded-full border border-foreground/25 px-4 py-1.5 text-xs transition-colors hover:bg-secondary">Try again</button>
        <Link href="/" className="rounded-full px-4 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">Back to ijra</Link>
      </div>
    </div>
  );
}
