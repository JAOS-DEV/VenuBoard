import type { ReactElement } from "react";

interface PaginationControlsProps {
  message: string;
}

export function PaginationControls({
  message,
}: PaginationControlsProps): ReactElement {
  return <p className="text-sm text-muted-foreground">{message}</p>;
}
