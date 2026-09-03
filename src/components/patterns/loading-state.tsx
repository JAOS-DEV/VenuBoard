import type { ReactElement } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  label: string;
  className?: string;
}

export function LoadingState({
  label,
  className,
}: LoadingStateProps): ReactElement {
  return (
    <div
      className={cn("space-y-2", className)}
      role="status"
      aria-label={label}
    >
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}
