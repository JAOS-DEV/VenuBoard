"use client";

import { useTheme } from "next-themes";
import type { CSSProperties, ReactElement, ReactNode } from "react";

import { safeVenueBrandStyle, type VenueBrandColors } from "@/core/ui/branding";

interface VenueBrandScopeProps {
  branding: VenueBrandColors | null | undefined;
  children: ReactNode;
  className?: string;
}

export function VenueBrandScope({
  branding,
  children,
  className,
}: VenueBrandScopeProps): ReactElement {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "dark" ? "dark" : "light";
  const style = safeVenueBrandStyle(branding, theme);

  return (
    <div className={className} style={style as CSSProperties | undefined}>
      {children}
    </div>
  );
}
