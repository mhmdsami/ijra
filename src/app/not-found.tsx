import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="type-display text-4xl leading-[1.02]">Nothing here.</p>
      <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">This page does not exist, or you do not have access to it.</p>
      <Link href="/" className="mt-6 rounded-md border px-3 py-1.5 text-xs transition-colors hover:bg-surface-2">Back to ijra</Link>
    </div>
  );
}
