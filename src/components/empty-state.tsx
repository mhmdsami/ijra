import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = "page",
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  variant?: "page" | "inline";
  className?: string;
}) {
  if (variant === "inline") {
    return (
      <div className={cn("px-2.5 py-3", className)}>
        <p className="text-sm text-foreground">{title}</p>
        {description && <p className="mt-1 text-xs leading-5 text-pretty text-muted-foreground">{description}</p>}
        {action && <div className="mt-2.5">{action}</div>}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center px-6 text-center", className)}>
      {Icon && (
        <span className="mb-4 grid size-9 place-items-center rounded-lg border bg-surface-1 text-text-tertiary">
          <Icon className="size-4" />
        </span>
      )}
      <p className="type-display text-2xl leading-tight">{title}</p>
      {description && <p className="mt-2 max-w-sm text-sm leading-6 text-pretty text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
