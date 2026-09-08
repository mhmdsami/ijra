"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Mode = "light" | "dark" | "system";
const KEY = "ijra-theme";

function apply(mode: Mode) {
  const dark = mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("dark");

  useEffect(() => {
    const saved = (localStorage.getItem(KEY) as Mode) ?? "dark";
    setMode(saved);
    apply(saved);
  }, []);

  function cycle() {
    const next: Mode = mode === "light" ? "dark" : mode === "dark" ? "system" : "light";
    localStorage.setItem(KEY, next);
    setMode(next);
    apply(next);
  }

  return (
    <Button variant="ghost" size="icon" onClick={cycle} aria-label={`Theme: ${mode}`}>
      <Sun className="dark:hidden" />
      <Moon className="hidden dark:block" />
    </Button>
  );
}
