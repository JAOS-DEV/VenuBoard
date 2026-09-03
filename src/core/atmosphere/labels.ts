import type { AtmosphereState } from "./constants";

export type AtmosphereCopyKey =
  "calm" | "social" | "lively" | "highEnergy" | "none";

export function atmosphereCopyKey(state: string | null): AtmosphereCopyKey {
  if (state === null) {
    return "none";
  }
  if (state === "calm" || state === "social" || state === "lively") {
    return state;
  }
  if (state === "high_energy") {
    return "highEnergy";
  }
  return "none";
}

export function atmospherePublicCopyKey(
  state: AtmosphereState,
): Exclude<AtmosphereCopyKey, "none"> {
  const key = atmosphereCopyKey(state);
  return key === "none" ? "calm" : key;
}

export function atmosphereBadgeVariant(
  state: AtmosphereState,
):
  | "atmosphereCalm"
  | "atmosphereSocial"
  | "atmosphereLively"
  | "atmosphereHighEnergy" {
  if (state === "calm") {
    return "atmosphereCalm";
  }
  if (state === "social") {
    return "atmosphereSocial";
  }
  if (state === "lively") {
    return "atmosphereLively";
  }
  return "atmosphereHighEnergy";
}
