import { cn } from "@/lib/utils";

export function Wordmark({ className }: { className?: string }) {
  return <span className={cn("type-display text-2xl leading-none text-foreground", className)}>ijra</span>;
}
