"use client";

import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

const CYCLE: Array<"light" | "dark" | "system"> = ["light", "dark", "system"];

const ICONS = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const;

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const Icon = ICONS[theme];

  return (
    <button
      type="button"
      aria-label={`Theme: ${theme}`}
      title={`Theme: ${theme} (click to change)`}
      onClick={() => {
        const idx = CYCLE.indexOf(theme);
        setTheme(CYCLE[(idx + 1) % CYCLE.length]);
      }}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200 ${className}`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}
