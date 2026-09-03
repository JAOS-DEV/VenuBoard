import { VenueAdminShell } from "@/components/shells/venue-admin-shell";
import { resolveRequestActor } from "@/core/actors/resolve";
import { canAccessVenueAdmin } from "@/core/authz/can";
import { venueAdminNavAccess } from "@/core/authz/surfaces";
import {
  parseSafeApplicationPath,
  signInNavigationHref,
} from "@/core/auth/redirects";
import { redirect } from "@/core/i18n/navigation";
import { resolveRequestLocale } from "@/core/i18n/server";
import { loadShellSession } from "@/core/shell/session";

export const dynamic = "force-dynamic";

interface AdminLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function AdminLayout({
  children,
  params,
}: AdminLayoutProps): Promise<React.ReactElement> {
  const locale = await resolveRequestLocale(params);
  const actor = await resolveRequestActor({ memberships: "own" });
  const session = await loadShellSession();

  if (actor.kind !== "authenticated") {
    redirect({
      href: signInNavigationHref(parseSafeApplicationPath("/admin")),
      locale,
    });
  }

  if (!canAccessVenueAdmin(actor)) {
    redirect({ href: "/unauthorized", locale });
  }

  const nav = venueAdminNavAccess(actor);

  return (
    <VenueAdminShell
      environment={session.environment}
      signedIn={session.signedIn}
      developerHubEnabled={session.developerHubEnabled}
      showStaff={nav.staff}
      showEvents={nav.events}
    >
      {children}
    </VenueAdminShell>
  );
}
