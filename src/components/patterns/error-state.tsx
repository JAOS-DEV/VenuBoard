import type { ReactElement, ReactNode } from "react";

import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function ErrorState({
  title,
  description,
  action,
  className,
}: ErrorStateProps): ReactElement {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm",
        className,
      )}
    >
      <p className="font-medium">{title}</p>
      {description ? (
        <p className="mt-1 text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
