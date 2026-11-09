import { GoogleSignIn } from "./google-signin";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_100%_at_50%_0%,color-mix(in_oklch,var(--primary)_12%,transparent),transparent)]"
      />
      <div className="animate-fade-up relative w-full max-w-sm rounded-lg border border-border bg-card p-8 shadow-[var(--shadow-card)]">
        <h1 className="type-display text-2xl tracking-tight">ijra</h1>
        <p className="mt-1 text-xs text-text-tertiary">Small fixes, run for you.</p>
        <h2 className="mt-7 text-base font-medium">Sign in</h2>
        <div className="mt-6">
          <GoogleSignIn />
        </div>
      </div>
    </main>
  );
}
