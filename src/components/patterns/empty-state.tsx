import type { ReactElement, ReactNode } from "react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: EmptyStateProps): ReactElement {
  return (
    <div
      className={cn("rounded-lg border border-dashed p-4 text-sm", className)}
    >
      <p className="font-medium">{title}</p>
      {description ? (
        <p className="mt-1 text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
