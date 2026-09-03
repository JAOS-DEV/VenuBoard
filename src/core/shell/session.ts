import { headerIdentity, resolveRequestActor } from "@/core/actors/resolve";
import { isOrdinaryLocalDevelopment } from "@/core/dev/guard";
import { serverEnv } from "@/core/env/server";

export async function loadShellSession(): Promise<{
  signedIn: boolean;
  environment: typeof serverEnv.VENUBOARD_ENV;
  developerHubEnabled: boolean;
}> {
  const actor = await resolveRequestActor({ memberships: "none" });
  const session = headerIdentity(actor);

  return {
    signedIn: session.signedIn,
    environment: serverEnv.VENUBOARD_ENV,
    developerHubEnabled: isOrdinaryLocalDevelopment(
      serverEnv.VENUBOARD_ENV,
      process.env.NODE_ENV,
    ),
  };
}
