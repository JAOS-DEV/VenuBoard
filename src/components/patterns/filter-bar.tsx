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
    <nav aria-label={label} className={cn("flex flex-wrap gap-2", className)}>
      {children}
    </nav>
  );
}
