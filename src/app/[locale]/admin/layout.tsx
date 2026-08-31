import { resolveRequestActor } from "@/core/actors/resolve";
import { canAccessVenueAdmin } from "@/core/authz/can";
import {
  parseSafeApplicationPath,
  signInNavigationHref,
} from "@/core/auth/redirects";
import { redirect } from "@/core/i18n/navigation";
import { resolveRequestLocale } from "@/core/i18n/server";

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

  if (actor.kind !== "authenticated") {
    redirect({
      href: signInNavigationHref(parseSafeApplicationPath("/admin")),
      locale,
    });
  }

  if (!canAccessVenueAdmin(actor)) {
    redirect({ href: "/unauthorized", locale });
  }

  return <>{children}</>;
}
