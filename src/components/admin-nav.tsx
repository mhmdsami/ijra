"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/admin", label: "Users" },
  { href: "/admin/models", label: "Models" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-0.5 rounded-lg border bg-surface-1 p-0.5">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={pathname === tab.href ? "page" : undefined}
          className={cn(
            "rounded-md px-2.5 py-1 text-2xs font-medium tracking-[0.06em] uppercase transition-colors",
            pathname === tab.href ? "bg-foreground text-background" : "text-text-tertiary hover:text-foreground"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
