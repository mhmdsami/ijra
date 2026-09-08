import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="text-4xl italic leading-[0.9] tracking-[-0.06em]" style={{ fontFamily: "var(--font-display)" }}>Nothing here.</p>
      <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">This page does not exist, or you do not have access to it.</p>
      <Link href="/" className="mt-6 rounded-full border border-foreground/25 px-4 py-1.5 text-xs transition-colors hover:bg-secondary">Back to ijra</Link>
    </div>
  );
}
