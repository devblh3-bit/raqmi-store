"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

interface SessionActivityWatcherProps {
  locale: string;
}

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const TOUCH_INTERVAL_MS = 2 * 60 * 1000; // Touch server at most once every 2 minutes
const CHECK_INTERVAL_MS = 15 * 1000; // Check idle status every 15 seconds

export default function SessionActivityWatcher({ locale }: SessionActivityWatcherProps) {
  const pathname = usePathname();
  const router = useRouter();
  const lastActivityRef = useRef<number | null>(null);
  const lastTouchedRef = useRef<number | null>(null);
  const isLoggingOutRef = useRef<boolean>(false);

  useEffect(() => {
    // Skip watching on login / auth pages
    if (pathname?.includes("/login")) return;

    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function handleTimeout() {
      if (isLoggingOutRef.current) return;
      isLoggingOutRef.current = true;

      try {
        await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "logout" }),
        });
      } catch {
        // Ignore failure, proceed to redirect
      }

      router.push(`/${locale}/login?error=inactive`);
      router.refresh();
    }

    async function touch() {
      lastTouchedRef.current = Date.now();
      try {
        const res = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "touch" }),
        });
        if (res.ok) {
          const data = await res.json();
          // If server failed to touch because session is dead, disconnect
          if (data?.touched === false) {
            handleTimeout();
          }
        }
      } catch {
        // Network blip, will retry next cycle
      }
    }

    async function init() {
      try {
        const res = await fetch("/api/auth/session");
        if (!res.ok) return;
        const data = await res.json();

        // If not authenticated or if "Stay logged in" was chosen, no idle disconnect
        if (!data.authenticated || data.remember) {
          return;
        }

        if (!active) return;

        // User is authenticated with a standard (non-remember) session.
        lastActivityRef.current = Date.now();
        lastTouchedRef.current = Date.now();

        const onUserActivity = () => {
          lastActivityRef.current = Date.now();
          const lastTouched = lastTouchedRef.current ?? 0;
          if (Date.now() - lastTouched >= TOUCH_INTERVAL_MS) {
            touch();
          }
        };

        const activityEvents = ["pointerdown", "keydown", "touchstart", "scroll"] as const;
        for (const evt of activityEvents) {
          window.addEventListener(evt, onUserActivity, { passive: true });
        }

        const onVisibilityChange = () => {
          if (document.visibilityState === "visible") {
            const lastActivity = lastActivityRef.current ?? Date.now();
            if (Date.now() - lastActivity >= IDLE_TIMEOUT_MS) {
              handleTimeout();
            } else {
              touch();
            }
          }
        };
        document.addEventListener("visibilitychange", onVisibilityChange);

        timer = setInterval(() => {
          const lastActivity = lastActivityRef.current ?? Date.now();
          if (Date.now() - lastActivity >= IDLE_TIMEOUT_MS) {
            handleTimeout();
          }
        }, CHECK_INTERVAL_MS);

        return () => {
          for (const evt of activityEvents) {
            window.removeEventListener(evt, onUserActivity);
          }
          document.removeEventListener("visibilitychange", onVisibilityChange);
          if (timer) clearInterval(timer);
        };
      } catch {
        // Session check failed; do nothing
      }
    }

    let cleanup: (() => void) | undefined;
    init().then((fn) => {
      cleanup = fn;
    });

    return () => {
      active = false;
      if (cleanup) cleanup();
      if (timer) clearInterval(timer);
    };
  }, [locale, pathname, router]);

  return null;
}
