import { useEffect, useState } from "react";

export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "theme-preference";

export function useTheme() {
  const [theme, setTheme] = useState<ThemePreference>(() => {
    if (typeof window === "undefined") return "system";
    return (localStorage.getItem(STORAGE_KEY) as ThemePreference) ?? "system";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    const apply = () => {
      if (theme === "system") {
        const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        root.classList.toggle("dark", dark);
      } else {
        root.classList.toggle("dark", theme === "dark");
      }
    };
    apply();
    localStorage.setItem(STORAGE_KEY, theme);

    if (theme === "system") {
      const mql = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => apply();
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
    }
  }, [theme]);

  return { theme, setTheme };
}
