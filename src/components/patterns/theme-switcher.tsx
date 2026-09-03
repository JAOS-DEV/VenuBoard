"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ThemeSwitcherProps {
  labels: {
    theme: string;
    light: string;
    dark: string;
    system: string;
  };
  compact?: boolean;
}

export function ThemeSwitcher({
  labels,
  compact = false,
}: ThemeSwitcherProps): ReactElement {
  const { theme, setTheme } = useTheme();

  const options = [
    { value: "light", label: labels.light, icon: Sun },
    { value: "dark", label: labels.dark, icon: Moon },
    { value: "system", label: labels.system, icon: Monitor },
  ] as const;

  const active = theme ?? "system";

  return (
    <div
      role="group"
      aria-label={labels.theme}
      className="inline-flex rounded-md border border-border p-0.5"
    >
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = active === option.value;
        return (
          <Button
            key={option.value}
            type="button"
            size="icon"
            variant="ghost"
            aria-pressed={isActive}
            aria-label={option.label}
            className={cn(isActive && "bg-secondary")}
            suppressHydrationWarning
            onClick={() => {
              setTheme(option.value);
            }}
          >
            <Icon />
            {compact ? null : (
              <span className="sr-only sm:not-sr-only sm:ms-1 sm:inline">
                {option.label}
              </span>
            )}
          </Button>
        );
      })}
    </div>
  );
}
