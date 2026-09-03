import { getTranslations } from "next-intl/server";

import { InvitationAcceptForm } from "@/components/auth/invitation-forms";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { resolveRequestActor } from "@/core/actors/resolve";
import { inspectInvitation } from "@/core/auth/inspect-invitation";
import { Link } from "@/core/i18n/navigation";
import { resolveRequestLocale } from "@/core/i18n/server";

interface InvitePageProps {
  params: Promise<{ locale: string; token: string }>;
}

export default async function InvitePage({
  params,
}: InvitePageProps): Promise<React.ReactElement> {
  const { token } = await params;
  await resolveRequestLocale(params);
  const t = await getTranslations("invite");
  const inspection = await inspectInvitation(token);
  const actor = await resolveRequestActor({ memberships: "none" });

  if (inspection.status !== "pending") {
    const title =
      inspection.status === "expired"
        ? t("expiredTitle")
        : inspection.status === "revoked"
          ? t("revokedTitle")
          : inspection.status === "accepted"
            ? t("acceptedTitle")
            : t("invalidTitle");
    const body =
      inspection.status === "expired"
        ? t("expiredBody")
        : inspection.status === "revoked"
          ? t("revokedBody")
          : inspection.status === "accepted"
            ? t("acceptedBody")
            : t("invalidBody");

    return (
      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{body}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/sign-in"
            className="text-sm underline underline-offset-4"
          >
            {t("goSignIn")}
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>
          {t("description", {
            role: inspection.role ?? "",
            venue: inspection.venueName ?? inspection.businessName ?? "",
            email: inspection.email ?? "",
          })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <InvitationAcceptForm
          token={token}
          signedIn={actor.kind === "authenticated"}
        />
      </CardContent>
    </Card>
  );
}
