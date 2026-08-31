import { resolveRequestActor } from "@/core/actors/resolve";
import { canAccessPlatform } from "@/core/authz/can";
import {
  parseSafeApplicationPath,
  signInNavigationHref,
} from "@/core/auth/redirects";
import { redirect } from "@/core/i18n/navigation";
import { resolveRequestLocale } from "@/core/i18n/server";

export const dynamic = "force-dynamic";

interface PlatformLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function PlatformLayout({
  children,
  params,
}: PlatformLayoutProps): Promise<React.ReactElement> {
  const locale = await resolveRequestLocale(params);
  const actor = await resolveRequestActor({ memberships: "platform" });

  if (actor.kind !== "authenticated") {
    redirect({
      href: signInNavigationHref(parseSafeApplicationPath("/platform")),
      locale,
    });
  }

  if (!canAccessPlatform(actor)) {
    redirect({ href: "/unauthorized", locale });
  }

  return <>{children}</>;
}
