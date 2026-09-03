import type { AtmosphereModuleAvailability } from "./module-state";
import type {
  AtmosphereExpiryMinutes,
  AtmospherePresentation,
  AtmosphereState,
} from "./constants";

export interface AtmosphereHistoryRow {
  id: string;
  action: "set" | "replace" | "clear";
  previousState: AtmosphereState | null;
  newState: AtmosphereState | null;
  expiryMinutes: AtmosphereExpiryMinutes | null;
  changedAt: string;
}

export interface AtmosphereCurrentState {
  state: AtmosphereState;
  expiresAt: string;
  setAt: string;
}

export interface AtmosphereSettingsView {
  isEnabled: boolean;
  isPubliclyVisible: boolean;
  defaultExpiryMinutes: AtmosphereExpiryMinutes;
  frontOfHouseMayUpdate: boolean;
  presentation: AtmospherePresentation;
  headingEn: string;
  headingTh: string;
}

export interface AdminAtmosphereData {
  moduleState: AtmosphereModuleAvailability;
  current: AtmosphereCurrentState | null;
  currentIsLive: boolean;
  settings: AtmosphereSettingsView;
  history: AtmosphereHistoryRow[];
  venueSlug: string;
}
