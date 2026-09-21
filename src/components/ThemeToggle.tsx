"use client";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const isDark = mounted && theme === "dark";

  return (
    <button
      aria-label={isDark ? "Switch to light mode" : "Light mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--fg-muted)] transition-all duration-200 hover:bg-[var(--surface)]/80 hover:text-[var(--fg)] hover:shadow-[var(--elev-1)] active:scale-95 sm:h-9 sm:w-9"
    >
      <span className="relative block h-4 w-4" aria-hidden>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`absolute inset-0 h-4 w-4 transition-all duration-300 ease-[var(--ease-premium)] ${isDark ? "rotate-90 opacity-0" : "rotate-0 opacity-100"}`}
        >
          <path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" />
        </svg>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`absolute inset-0 h-4 w-4 transition-all duration-300 ease-[var(--ease-premium)] ${isDark ? "rotate-0 opacity-100" : "-rotate-90 opacity-0"}`}
        >
          <circle cx={12} cy={12} r={5} />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      </span>
    </button>
  );
}
