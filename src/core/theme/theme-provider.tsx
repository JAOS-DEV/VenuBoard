"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
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

function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined") {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolveTheme(theme: ThemeName): ResolvedTheme {
  return theme === "system" ? systemTheme() : theme;
}

function applyDocumentTheme(theme: ThemeName): ResolvedTheme {
  const resolved = resolveTheme(theme);
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
  return resolved;
}

export function ThemeProvider({ children }: ThemeProviderProps): ReactElement {
  const [theme, setThemeState] = useState<ThemeName>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");
  const themeRef = useRef(theme);
  themeRef.current = theme;

  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    const initial = isThemeName(stored) ? stored : "system";
    setThemeState(initial);
    setResolvedTheme(applyDocumentTheme(initial));

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    function onMediaChange(): void {
      if (themeRef.current === "system") {
        setResolvedTheme(applyDocumentTheme("system"));
      }
    }
    media.addEventListener("change", onMediaChange);

    function onStorage(event: StorageEvent): void {
      if (event.key !== THEME_STORAGE_KEY) {
        return;
      }
      const next = isThemeName(event.newValue) ? event.newValue : "system";
      setThemeState(next);
      setResolvedTheme(applyDocumentTheme(next));
    }
    window.addEventListener("storage", onStorage);

    return () => {
      media.removeEventListener("change", onMediaChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setTheme = useCallback((value: string): void => {
    const next = isThemeName(value) ? value : "system";
    setThemeState(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private mode can refuse localStorage; the in-memory theme still applies.
    }
    setResolvedTheme(applyDocumentTheme(next));
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
