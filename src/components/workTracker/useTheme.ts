import { useEffect, useState } from "react";

export type Theme = "system" | "dark" | "light";

const STORAGE_KEY = "work-tracker-theme";

function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light" || stored === "system") {
      return stored;
    }
  } catch {
    // ignore storage errors
  }
  return "system";
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);

  useEffect(() => {
    const root = document.documentElement;

    if (theme === "dark") {
      root.classList.add("dark");
      return;
    }

    if (theme === "light") {
      root.classList.remove("dark");
      return;
    }

    // system: follow OS preference and subscribe to changes
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    if (mq.matches) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    };

    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch {
      // ignore storage errors
    }
    setThemeState(newTheme);
  };

  return { theme, setTheme };
}
