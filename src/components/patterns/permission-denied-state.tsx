import type { ReactElement } from "react";

import { ErrorState } from "@/components/patterns/error-state";

interface PermissionDeniedStateProps {
  title: string;
  description?: string;
}

export function PermissionDeniedState({
  title,
  description,
}: PermissionDeniedStateProps): ReactElement {
  return <ErrorState title={title} description={description} />;
}
