import {
  conditionalTenantGrantOk,
  isPermissionAction,
  type PermissionAction,
} from "./actions";

export type GrantKind = "allow" | "conditional" | "deny";

export interface RoleActionGrant {
  roleKey: string;
  actionKey: string;
  grantKind: GrantKind;
}

/**
 * Resolve whether a stored matrix cell is effective. Absence is deny.
 * Conditional cells default-deny unless the database already treats them as
 * checkable, or the caller proved a named condition.
 *
 * This reads grant rows; it does not duplicate the 33×7 matrix as constants.
 */
export function effectiveGrant(
  grants: readonly RoleActionGrant[],
  roleKey: string,
  actionKey: string,
  provenConditions: readonly string[] = [],
): boolean {
  if (!isPermissionAction(actionKey)) {
    return false;
  }

  const grant = grants.find(
    (row) => row.roleKey === roleKey && row.actionKey === actionKey,
  );

  if (grant === undefined || grant.grantKind === "deny") {
    return false;
  }

  if (grant.grantKind === "allow") {
    return true;
  }

  if (conditionalTenantGrantOk(roleKey, actionKey)) {
    return true;
  }

  return provenConditions.includes(`${roleKey}:${actionKey}`);
}

export function grantFor(
  grants: readonly RoleActionGrant[],
  roleKey: string,
  action: PermissionAction,
): RoleActionGrant | undefined {
  return grants.find(
    (row) => row.roleKey === roleKey && row.actionKey === action,
  );
}
