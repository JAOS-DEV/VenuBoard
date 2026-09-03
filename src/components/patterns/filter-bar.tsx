import type { ReactElement, ReactNode } from "react";

import { cn } from "@/lib/utils";

interface FilterBarProps {
  label: string;
  children: ReactNode;
  className?: string;
}

export function FilterBar({
  label,
  children,
  className,
}: FilterBarProps): ReactElement {
  return (
    <nav
      aria-label={label}
      className={cn(
        "-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0",
        className,
      )}
    >
      {children}
    </nav>
  );
}
