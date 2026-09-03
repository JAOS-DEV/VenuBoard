import type { ReactElement, ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  headingId?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function SectionHeader({
  headingId,
  title,
  description,
  actions,
  className,
}: SectionHeaderProps): ReactElement {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="space-y-1">
        <h2 id={headingId} className="text-base font-semibold tracking-tight">
          {title}
        </h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
