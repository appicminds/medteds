"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

type Theme = "system" | "light" | "dark";

/** Runs before paint (see layout) so the chosen theme never flashes. */
export const themeScript = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

// The saved theme lives in localStorage; this tiny store lets every toggle on the page stay in sync.
const listeners = new Set<() => void>();

function readTheme(): Theme {
  try {
    const t = localStorage.getItem("theme");
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  window.addEventListener("storage", fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", fn);
  };
}

function setTheme(t: Theme) {
  try {
    if (t === "system") localStorage.removeItem("theme");
    else localStorage.setItem("theme", t);
  } catch {}
  const root = document.documentElement;
  if (t === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", t);
  listeners.forEach((fn) => fn());
}

export function ThemeToggle({ className }: { className?: string }) {
  // The server can't see localStorage, so it renders "system"; React swaps in the saved value after hydrating.
  const theme = useSyncExternalStore(subscribe, readTheme, () => "system" as Theme);

  const options: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: "light", label: "Light", icon: <Sun size={15} /> },
    { value: "dark", label: "Dark", icon: <Moon size={15} /> },
    { value: "system", label: "Device", icon: <Monitor size={15} /> },
  ];

  return (
    <div role="radiogroup" aria-label="Theme" className={cn("inline-flex rounded-pill bg-surface p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={theme === o.value}
          onClick={() => setTheme(o.value)}
          className={cn(
            "inline-flex cursor-pointer items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs transition-colors",
            theme === o.value ? "bg-bg text-fg shadow-card" : "text-muted hover:text-fg",
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}
