import { Badge } from "@/components/ui/badge";
import {
  shouldShowEnvironmentBadge,
  type VenuBoardEnvironment,
} from "@/core/env/environment";

interface EnvironmentBadgeProps {
  environment: VenuBoardEnvironment;
  label: string;
}

/**
 * Shows which environment is being viewed, so staging is never mistaken for
 * production (ADR-034). Renders nothing in production: customers must not see
 * internal environment labelling.
 *
 * The environment is passed in as a prop rather than read from a
 * `NEXT_PUBLIC_*` variable, which keeps the identifier server-side.
 */
export function EnvironmentBadge({
  environment,
  label,
}: EnvironmentBadgeProps): React.ReactElement | null {
  if (!shouldShowEnvironmentBadge(environment)) {
    return null;
  }

  return (
    <Badge variant={environment === "staging" ? "destructive" : "secondary"}>
      <span className="sr-only">{label}: </span>
      {environment}
    </Badge>
  );
}
