"use client";

import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  function toggleTheme() {
    const nextDark = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", nextDark);
    document.documentElement.setAttribute("data-theme", nextDark ? "dark" : "light");
    document.documentElement.style.colorScheme = nextDark ? "dark" : "light";
    window.localStorage.setItem("theme", nextDark ? "dark" : "light");
  }

  return (
    <Button
      aria-label="تغییر تم"
      className="size-10 rounded-xl border border-gray-200/60 bg-white/70 text-gray-900 shadow-sm transition hover:shadow dark:border-gray-800/60 dark:bg-gray-900/70 dark:text-gray-100"
      size="icon"
      type="button"
      variant="outline"
      onClick={toggleTheme}
    >
      <Moon className="dark:hidden" />
      <Sun className="hidden dark:block" />
    </Button>
  );
}
