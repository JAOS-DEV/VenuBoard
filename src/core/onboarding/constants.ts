export const STANDARD_TRIAL_DAYS = 30;

export const DEFAULT_TIMEZONE = "Asia/Bangkok";

export const IDEMPOTENCY_STORAGE_KEY = "vb.platform-onboarding.idempotency";

export const DEFAULT_BRANDING = {
  primaryColor: "#1F2937",
  secondaryColor: "#F59E0B",
  accentColor: "#F59E0B",
  backgroundColor: "#FFFFFF",
  textColor: "#111827",
  themeKey: "system",
  fontKey: "system" as const,
};

export const TIMEZONE_SUGGESTIONS = [
  "Asia/Bangkok",
  "Asia/Phuket",
  "UTC",
] as const;
