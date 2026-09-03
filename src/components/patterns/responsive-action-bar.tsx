import type { ReactElement, ReactNode } from "react";

import { cn } from "@/lib/utils";

interface ResponsiveActionBarProps {
  children: ReactNode;
  sticky?: boolean;
  className?: string;
}

export function ResponsiveActionBar({
  children,
  sticky = false,
  className,
}: ResponsiveActionBarProps): ReactElement {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:flex-wrap",
        sticky &&
          "sticky bottom-0 z-20 border-t border-border bg-background/95 py-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
