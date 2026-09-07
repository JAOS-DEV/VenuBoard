"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
} from "react";

import {
  isThemeName,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemeName,
} from "./constants";

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (theme: string) => void;
  resolvedTheme: ResolvedTheme;
}

interface ThemeProviderProps {
  children: ReactNode;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const themeListeners = new Set<() => void>();
let sessionTheme: ThemeName | null = null;

function notifyThemeListeners(): void {
  for (const listener of themeListeners) {
    listener();
  }
}

function readStoredTheme(): ThemeName {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeName(stored)) {
      return stored;
    }
    return "system";
  } catch {
    return sessionTheme ?? "system";
  }
}

function subscribeStoredTheme(onStoreChange: () => void): () => void {
  themeListeners.add(onStoreChange);
  function onStorage(event: StorageEvent): void {
    if (event.key !== THEME_STORAGE_KEY && event.key !== null) {
      return;
    }
    onStoreChange();
  }
  window.addEventListener("storage", onStorage);
  return () => {
    themeListeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

function writeStoredTheme(next: ThemeName): void {
  sessionTheme = next;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Private mode can refuse localStorage; the in-memory theme still applies.
  }
  notifyThemeListeners();
}

function subscribeSystemTheme(onStoreChange: () => void): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

function readSystemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolveTheme(
  theme: ThemeName,
  systemPreference: ResolvedTheme,
): ResolvedTheme {
  return theme === "system" ? systemPreference : theme;
}

function applyDocumentTheme(resolved: ResolvedTheme): void {
  const root = document.documentElement;
  const style = document.createElement("style");
  style.appendChild(
    document.createTextNode(
      "*,*::before,*::after{-webkit-transition:none!important;transition:none!important}",
    ),
  );
  document.head.appendChild(style);
  root.classList.remove("light", "dark");
  root.classList.add(resolved);
  root.style.colorScheme = resolved;
  window.getComputedStyle(document.body);
  window.setTimeout(() => {
    style.remove();
  }, 1);
}

export function ThemeProvider({ children }: ThemeProviderProps): ReactElement {
  const theme = useSyncExternalStore(
    subscribeStoredTheme,
    readStoredTheme,
    (): ThemeName => "system",
  );
  const systemPreference = useSyncExternalStore(
    subscribeSystemTheme,
    readSystemTheme,
    (): ResolvedTheme => "light",
  );
  const resolvedTheme = resolveTheme(theme, systemPreference);

  useEffect(() => {
    applyDocumentTheme(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = useCallback((value: string): void => {
    writeStoredTheme(isThemeName(value) ? value : "system");
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, resolvedTheme }),
    [theme, setTheme, resolvedTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    return {
      theme: "system",
      setTheme: (): void => undefined,
      resolvedTheme: "light",
    };
  }
  return context;
}
