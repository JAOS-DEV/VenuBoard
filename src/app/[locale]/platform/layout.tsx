import { headers } from "next/headers";

import { PlatformAdminShell } from "@/components/shells/platform-admin-shell";
import { resolveRequestActor } from "@/core/actors/resolve";
import { canAccessPlatform, canOnboardTenants } from "@/core/authz/can";
import {
  parseSafeApplicationPath,
  signInNavigationHref,
  toNavigationHref,
} from "@/core/auth/redirects";
import { redirect } from "@/core/i18n/navigation";
import { resolveRequestLocale } from "@/core/i18n/server";
import { loadShellSession } from "@/core/shell/session";

export const dynamic = "force-dynamic";

interface PlatformLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

function platformReturnPath(raw: string | null): string {
  const parsed = parseSafeApplicationPath(raw);
  if (parsed === null) {
    return "/platform";
  }
  const href = toNavigationHref(parsed);
  if (href === "/platform" || href.startsWith("/platform/")) {
    return href;
  }
  return "/platform";
}

export default async function PlatformLayout({
  children,
  params,
}: PlatformLayoutProps): Promise<React.ReactElement> {
  const locale = await resolveRequestLocale(params);
  const actor = await resolveRequestActor({ memberships: "platform" });
  const headerStore = await headers();
  const session = await loadShellSession();

  if (actor.kind !== "authenticated") {
    redirect({
      href: signInNavigationHref(
        parseSafeApplicationPath(
          platformReturnPath(headerStore.get("x-venuboard-pathname")),
        ),
      ),
      locale,
    });
  }

  if (!canAccessPlatform(actor)) {
    redirect({ href: "/unauthorized", locale });
  }

  return (
    <PlatformAdminShell
      environment={session.environment}
      signedIn={session.signedIn}
      developerHubEnabled={session.developerHubEnabled}
      canOnboard={canOnboardTenants(actor)}
    >
      {children}
    </PlatformAdminShell>
  );
}
