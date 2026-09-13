import { OSM_DIRECTIONS_BASE, OSM_SEARCH_BASE } from "./constants";

const CONTROL = /[\u0000-\u001F\u007F]/;

export function publicTelHref(phone: string): string | null {
  const trimmed = phone.trim();
  if (CONTROL.test(trimmed)) {
    return null;
  }
  if (!/^\+?[0-9][0-9 \-]{6,22}[0-9]$/.test(trimmed)) {
    return null;
  }
  const digits = trimmed.replace(/[^\d+]/g, "");
  if (digits.length < 8) {
    return null;
  }
  return `tel:${digits}`;
}

export function publicMailtoHref(email: string): string | null {
  const trimmed = email.trim();
  if (CONTROL.test(trimmed)) {
    return null;
  }
  if (!/^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$/i.test(trimmed)) {
    return null;
  }
  return `mailto:${trimmed}`;
}

export function publicHttpUrl(value: string): string | null {
  const trimmed = value.trim();
  if (CONTROL.test(trimmed) || trimmed.includes("@")) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return null;
  }
  if (parsed.username !== "" || parsed.password !== "") {
    return null;
  }
  if (parsed.hostname.length < 1) {
    return null;
  }
  return parsed.toString();
}

export function openStreetMapHref(input: {
  latitude: number | null;
  longitude: number | null;
  address: string | null;
}): string | null {
  if (input.latitude !== null && input.longitude !== null) {
    const lat = input.latitude.toFixed(6);
    const lng = input.longitude.toFixed(6);
    return `${OSM_DIRECTIONS_BASE}?to=${encodeURIComponent(`${lat},${lng}`)}`;
  }
  const address = input.address?.trim() ?? "";
  if (address.length === 0) {
    return null;
  }
  return `${OSM_SEARCH_BASE}?query=${encodeURIComponent(address)}`;
}
