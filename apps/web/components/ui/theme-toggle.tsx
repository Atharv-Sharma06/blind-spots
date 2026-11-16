"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";

type Theme = "dark" | "light";

const STORAGE_KEY = "bs-theme";

/** The theme the boot script in app/layout.tsx put on <html> (falls back to the OS preference). */
function readTheme(): Theme {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "dark" || attr === "light") return attr;
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
}

// Every toggle on the page (sidebar, top bar, landing header) and other tabs stay in step via <html data-theme>.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && (e.newValue === "dark" || e.newValue === "light")) applyTheme(e.newValue);
  };
  window.addEventListener("storage", onStorage);
  return () => {
    observer.disconnect();
    window.removeEventListener("storage", onStorage);
  };
}

/** Round sun/moon button that switches between the light and dark design. Remembers the choice in localStorage. */
export function ThemeToggle({ className }: { className?: string }) {
  // Server and first client render both say "light"; the real theme is read right after hydration.
  const theme = useSyncExternalStore(subscribe, readTheme, () => "light" as Theme);
  const dark = theme === "dark";

  function toggle() {
    const next: Theme = dark ? "light" : "dark";
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* private window or blocked storage: the switch still works for this visit */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={dark}
      data-testid="theme-toggle"
      suppressHydrationWarning
      className={cn("btn-round print:hidden!", className)}
    >
      {dark ? <Sun aria-hidden className="size-[18px]" /> : <Moon aria-hidden className="size-[18px]" />}
    </button>
  );
}
