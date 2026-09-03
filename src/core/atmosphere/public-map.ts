import type { AtmospherePresentation, AtmosphereState } from "./constants";
import { isAtmosphereState, ATMOSPHERE_PRESENTATIONS } from "./constants";

export interface PublicAtmosphereCard {
  available: boolean;
  heading: string | null;
  statusKey: AtmosphereState | null;
  presentation: AtmospherePresentation;
  freshness: "current" | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function mapPublicAtmosphere(payload: unknown): PublicAtmosphereCard {
  const hidden: PublicAtmosphereCard = {
    available: false,
    heading: null,
    statusKey: null,
    presentation: "card",
    freshness: null,
  };

  const record = asRecord(payload);
  if (record === null || record.ok !== true || record.available !== true) {
    return hidden;
  }

  const status =
    typeof record.status_key === "string" &&
    isAtmosphereState(record.status_key)
      ? record.status_key
      : null;
  if (status === null) {
    return hidden;
  }

  const presentation =
    typeof record.presentation === "string" &&
    (ATMOSPHERE_PRESENTATIONS as readonly string[]).includes(
      record.presentation,
    )
      ? (record.presentation as AtmospherePresentation)
      : "card";

  return {
    available: true,
    heading: typeof record.heading === "string" ? record.heading : null,
    statusKey: status,
    presentation,
    freshness: "current",
  };
}
