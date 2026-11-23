"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type ThemePreset = "editorial" | "studio" | "bento";
export type ThemeMode = "light" | "dark" | "system";
export type ResolvedThemeMode = "light" | "dark";

export interface ThemeMeta {
  id: ThemePreset;
  name: string;
  tagline: string;
  daySwatches: [string, string, string];
  nightSwatches: [string, string, string];
  radiusPreview: string;
}

export const THEME_PRESETS: ThemeMeta[] = [
  {
    id: "editorial",
    name: "Warm Editorial",
    tagline: "Warm neutral paper · Terracotta accent",
    daySwatches: ["#F5F3EF", "#FFFFFF", "#C74A2D"],
    nightSwatches: ["#12110F", "#1C1A18", "#EE7355"],
    radiusPreview: "rounded-[8px]",
  },
  {
    id: "studio",
    name: "Broadcast Studio",
    tagline: "Cool studio slate · Cyan telemetry accent",
    daySwatches: ["#F2F4F7", "#FFFFFF", "#0B7B94"],
    nightSwatches: ["#0F1012", "#1A1C20", "#3CC4DC"],
    radiusPreview: "rounded-[6px]",
  },
  {
    id: "bento",
    name: "Crisp Graphite",
    tagline: "Crisp graphite · Cobalt accent",
    daySwatches: ["#F4F4F5", "#FFFFFF", "#2563EB"],
    nightSwatches: ["#0F0F10", "#19191B", "#60A5FA"],
    radiusPreview: "rounded-[10px]",
  },
];

export const THEME_STORAGE_KEY = "vokalai_theme";
export const MODE_STORAGE_KEY = "vokalai_mode";
export const DEFAULT_THEME: ThemePreset = "editorial";
export const DEFAULT_MODE: ThemeMode = "light";

interface ThemeContextValue {
  theme: ThemePreset;
  mode: ThemeMode;
  resolvedMode: ResolvedThemeMode;
  isDark: boolean;
  setTheme: (next: ThemePreset) => void;
  setMode: (next: ThemeMode) => void;
  toggleMode: () => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isValidTheme(v: string | null): v is ThemePreset {
  return v === "editorial" || v === "studio" || v === "bento";
}

function isValidMode(v: string | null): v is ThemeMode {
  return v === "light" || v === "dark" || v === "system";
}

function getSystemMode(): ResolvedThemeMode {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyToDocument(theme: ThemePreset, resolved: ResolvedThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.mode = resolved;
  root.style.colorScheme = resolved;
  root.classList.toggle("dark", resolved === "dark");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreset>(DEFAULT_THEME);
  const [mode, setModeState] = useState<ThemeMode>(DEFAULT_MODE);
  const [systemMode, setSystemMode] = useState<ResolvedThemeMode>("light");

  // Hydrate persisted preferences once on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    const savedMode = localStorage.getItem(MODE_STORAGE_KEY);
    const currentSys = getSystemMode();

    const nextTheme = isValidTheme(savedTheme) ? savedTheme : DEFAULT_THEME;
    const nextMode = isValidMode(savedMode) ? savedMode : DEFAULT_MODE;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate saved appearance once on mount
    setSystemMode(currentSys);
    setThemeState(nextTheme);
    setModeState(nextMode);
    applyToDocument(nextTheme, nextMode === "system" ? currentSys : nextMode);
  }, []);

  // Listen to OS color-scheme changes
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      setSystemMode(e.matches ? "dark" : "light");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolvedMode: ResolvedThemeMode =
    mode === "system" ? systemMode : mode;

  useEffect(() => {
    applyToDocument(theme, resolvedMode);
  }, [theme, resolvedMode]);

  const setTheme = useCallback((next: ThemePreset) => {
    setThemeState(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // ignore storage errors
    }
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    try {
      localStorage.setItem(MODE_STORAGE_KEY, next);
    } catch {
      // ignore storage errors
    }
  }, []);

  const toggleMode = useCallback(() => {
    setMode(resolvedMode === "dark" ? "light" : "dark");
  }, [resolvedMode, setMode]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      mode,
      resolvedMode,
      isDark: resolvedMode === "dark",
      setTheme,
      setMode,
      toggleMode,
      toggleTheme: toggleMode,
    }),
    [theme, mode, resolvedMode, setTheme, setMode, toggleMode]
  );

  return createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      theme: DEFAULT_THEME,
      mode: DEFAULT_MODE,
      resolvedMode: "light",
      isDark: false,
      setTheme: () => {},
      setMode: () => {},
      toggleMode: () => {},
      toggleTheme: () => {},
    };
  }
  return ctx;
}
