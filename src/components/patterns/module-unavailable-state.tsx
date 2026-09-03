import type { ReactElement, ReactNode } from "react";

import { EmptyState } from "@/components/patterns/empty-state";

interface ModuleUnavailableStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function ModuleUnavailableState({
  title,
  description,
  action,
}: ModuleUnavailableStateProps): ReactElement {
  return <EmptyState title={title} description={description} action={action} />;
}
