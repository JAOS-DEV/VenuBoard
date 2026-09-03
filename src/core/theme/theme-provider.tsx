"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactElement, ReactNode } from "react";

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps): ReactElement {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="venuboard-theme"
    >
      {children}
    </NextThemesProvider>
  );
}
