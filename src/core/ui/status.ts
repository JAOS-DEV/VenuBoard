export type ModuleAvailabilityState =
  | "not_entitled"
  | "entitled_disabled"
  | "enabled"
  | "trial"
  | "expired"
  | "restricted"
  | "suspended";

export type UiStatusKey =
  | "present"
  | "notPresent"
  | "draft"
  | "scheduled"
  | "published"
  | "cancelled"
  | "archived"
  | "pending"
  | "quarantined"
  | "disabled"
  | "notEntitled"
  | "moduleDisabled"
  | "trialExpired"
  | "temporarilyUnavailable"
  | "trial"
  | "enabled";

const MODULE_STATE_COPY: Record<ModuleAvailabilityState, UiStatusKey> = {
  not_entitled: "notEntitled",
  entitled_disabled: "moduleDisabled",
  enabled: "enabled",
  trial: "trial",
  expired: "trialExpired",
  restricted: "temporarilyUnavailable",
  suspended: "temporarilyUnavailable",
};

export function moduleAvailabilityCopyKey(state: string): UiStatusKey {
  if (state in MODULE_STATE_COPY) {
    return MODULE_STATE_COPY[state as ModuleAvailabilityState];
  }
  return "temporarilyUnavailable";
}

export function isRawInternalState(value: string): boolean {
  return [
    "not_entitled",
    "entitled_disabled",
    "pending_approval",
    "approval_status",
    "rejection_reason",
  ].includes(value);
}
