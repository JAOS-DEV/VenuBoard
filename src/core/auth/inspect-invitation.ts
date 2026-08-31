import "server-only";

import {
  mapInvitationInspection,
  type InvitationInspection,
} from "@/core/auth/invitation-state";
import { isPlausibleInvitationToken } from "@/core/auth/invitation-links";
import { getSupabaseConnection } from "@/core/db/connection";
import { createSupabaseServerClient } from "@/core/db/server-client";

export async function inspectInvitation(
  token: string,
): Promise<InvitationInspection> {
  if (!isPlausibleInvitationToken(token) || getSupabaseConnection() === null) {
    return mapInvitationInspection({ status: "invalid" });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("inspect_invitation", {
    p_token: token,
  });

  if (error || data === null) {
    return mapInvitationInspection({ status: "invalid" });
  }

  return mapInvitationInspection(data);
}
