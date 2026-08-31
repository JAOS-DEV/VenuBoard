import "server-only";

export const ADMIN_SCOPE_COOKIE = "vb_admin_scope";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface AdminScopeSelection {
  businessId: string;
  venueId: string;
}

export function parseAdminScopeCookie(
  raw: string | undefined,
): AdminScopeSelection | null {
  if (raw === undefined || raw.length === 0) {
    return null;
  }

  const [businessId, venueId] = raw.split(":");
  if (
    businessId === undefined ||
    venueId === undefined ||
    !UUID.test(businessId) ||
    !UUID.test(venueId)
  ) {
    return null;
  }

  return { businessId, venueId };
}

export function serializeAdminScopeCookie(
  selection: AdminScopeSelection,
): string {
  return `${selection.businessId}:${selection.venueId}`;
}
