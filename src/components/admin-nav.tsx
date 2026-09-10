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
    <nav className="flex items-center gap-0.5 rounded-full border border-border p-0.5">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            "rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wide transition-colors",
            pathname === tab.href ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
