import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { THEME_STORAGE_KEY } from "@/core/theme/constants";
import { THEME_INIT_SCRIPT } from "@/core/theme/init-script";
import { ThemeProvider, useTheme } from "@/core/theme/theme-provider";

function ThemeProbe(): ReactElement {
  const { theme, setTheme, resolvedTheme } = useTheme();
  return (
    <div>
      <p>theme:{theme}</p>
      <p>resolved:{resolvedTheme}</p>
      <button type="button" onClick={() => setTheme("dark")}>
        Dark
      </button>
      <button type="button" onClick={() => setTheme("light")}>
        Light
      </button>
      <button type="button" onClick={() => setTheme("system")}>
        System
      </button>
    </div>
  );
}

function mockMatchMedia(matches: boolean): {
  setMatches: (next: boolean) => void;
} {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const media: MediaQueryList = {
    matches,
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addEventListener(
      _type: string,
      listener: EventListenerOrEventListenerObject,
    ): void {
      if (typeof listener === "function") {
        listeners.add(listener as (event: MediaQueryListEvent) => void);
      }
    },
    removeEventListener(
      _type: string,
      listener: EventListenerOrEventListenerObject,
    ): void {
      if (typeof listener === "function") {
        listeners.delete(listener as (event: MediaQueryListEvent) => void);
      }
    },
    addListener(listener: (event: MediaQueryListEvent) => void): void {
      listeners.add(listener);
    },
    removeListener(listener: (event: MediaQueryListEvent) => void): void {
      listeners.delete(listener);
    },
    dispatchEvent(): boolean {
      return true;
    },
  };
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: () => media,
  });
  return {
    setMatches(next: boolean): void {
      media.matches = next;
      const event = { matches: next } as MediaQueryListEvent;
      act(() => {
        for (const listener of listeners) {
          listener(event);
        }
      });
    },
  };
}

describe("theme bootstrap", () => {
  it("keeps the theme init script static and bound to the storage key", () => {
    expect(THEME_INIT_SCRIPT).toContain(THEME_STORAGE_KEY);
    expect(THEME_INIT_SCRIPT).toContain("localStorage");
    expect(THEME_INIT_SCRIPT).not.toContain("<script");
  });

  it("does not render a script tag from the client ThemeProvider", () => {
    const source = readFileSync("src/core/theme/theme-provider.tsx", "utf8");
    expect(source).not.toContain("<script");
    expect(source).not.toContain("dangerouslySetInnerHTML");
    expect(source).not.toContain("next-themes");
  });

  it("applies a stored theme before React hydrates", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    document.documentElement.classList.remove("light", "dark");
    const run = new Function(THEME_INIT_SCRIPT) as () => void;
    run();
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });
});

describe("ThemeProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove("light", "dark");
    mockMatchMedia(false);
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("persists an explicit theme and restores it after remount", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Dark" }));
    expect(screen.getByText("theme:dark")).toBeInTheDocument();
    expect(document.documentElement).toHaveClass("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");

    unmount();
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    expect(screen.getByText("theme:dark")).toBeInTheDocument();
    expect(document.documentElement).toHaveClass("dark");
  });

  it("follows the system preference while theme is system", () => {
    const media = mockMatchMedia(true);
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    expect(screen.getByText("theme:system")).toBeInTheDocument();
    expect(screen.getByText("resolved:dark")).toBeInTheDocument();
    expect(document.documentElement).toHaveClass("dark");

    media.setMatches(false);
    expect(screen.getByText("resolved:light")).toBeInTheDocument();
    expect(document.documentElement).toHaveClass("light");
  });

  it("keeps an explicit theme when the system preference changes", async () => {
    const user = userEvent.setup();
    const media = mockMatchMedia(false);
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Dark" }));
    expect(screen.getByText("theme:dark")).toBeInTheDocument();
    expect(screen.getByText("resolved:dark")).toBeInTheDocument();

    media.setMatches(true);
    expect(screen.getByText("theme:dark")).toBeInTheDocument();
    expect(screen.getByText("resolved:dark")).toBeInTheDocument();
    expect(document.documentElement).toHaveClass("dark");
  });
});
