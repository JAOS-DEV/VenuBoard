/**
 * The MVP permission catalogue. Keys match `public.permission_actions` exactly
 * once. Unknown strings are not members of this union and deny at runtime.
 */
export const PERMISSION_ACTIONS = [
  "manage_business",
  "manage_venue",
  "manage_branding",
  "invite_users",
  "assign_roles",
  "view_private_staff_data",
  "manage_public_staff_profiles",
  "toggle_staff_presence",
  "create_content",
  "approve_content",
  "publish_content",
  "manage_events",
  "view_bookings",
  "manage_bookings",
  "view_analytics",
  "export_data",
  "manage_venue_module_visibility",
  "manage_platform_entitlements",
  "view_booking_customer_details",
  "manage_atmosphere",
  "manage_offers",
  "manage_own_public_profile",
  "toggle_own_presence",
  "manage_own_consent",
  "submit_content_for_approval",
  "manage_venue_domains",
  "manage_notification_preferences",
  "view_audit_log",
  "manage_platform_tenants",
  "start_support_session",
  "grant_support_write_access",
  "manage_platform_users",
  "moderate_content",
] as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

const PERMISSION_ACTION_SET = new Set<string>(PERMISSION_ACTIONS);

export function isPermissionAction(value: string): value is PermissionAction {
  return PERMISSION_ACTION_SET.has(value);
}

export const PLATFORM_RECORD_ACTIONS = [
  "manage_platform_entitlements",
  "manage_platform_tenants",
  "manage_platform_users",
  "start_support_session",
  "grant_support_write_access",
] as const;

export type PlatformRecordAction = (typeof PLATFORM_RECORD_ACTIONS)[number];

const PLATFORM_RECORD_ACTION_SET = new Set<string>(PLATFORM_RECORD_ACTIONS);

export function isPlatformRecordAction(
  action: string,
): action is PlatformRecordAction {
  return PLATFORM_RECORD_ACTION_SET.has(action);
}

const TENANT_WRITE_ACTIONS = new Set<string>([
  "manage_business",
  "manage_venue",
  "manage_branding",
  "invite_users",
  "assign_roles",
  "manage_public_staff_profiles",
  "toggle_staff_presence",
  "create_content",
  "approve_content",
  "publish_content",
  "manage_events",
  "manage_bookings",
  "export_data",
  "manage_venue_module_visibility",
  "manage_atmosphere",
  "manage_offers",
  "submit_content_for_approval",
  "manage_venue_domains",
]);

export function isTenantWriteAction(action: string): boolean {
  return TENANT_WRITE_ACTIONS.has(action);
}

/**
 * Conditional cells that the database currently treats as effective at the
 * grant-helper layer. C3 and C14 stay false here so staff never receive a
 * blanket `toggle_staff_presence` grant; row-level `may_set_staff_presence`
 * implements those conditions.
 */
export function conditionalTenantGrantOk(
  roleKey: string,
  actionKey: string,
): boolean {
  if (roleKey === "venue_manager" && actionKey === "assign_roles") {
    return true;
  }
  if (actionKey === "view_audit_log") {
    return true;
  }
  return false;
}
