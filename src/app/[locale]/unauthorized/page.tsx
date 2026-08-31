import { getTranslations } from "next-intl/server";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "@/core/i18n/navigation";
import { resolveRequestLocale } from "@/core/i18n/server";

interface UnauthorizedPageProps {
  params: Promise<{ locale: string }>;
}

export default async function UnauthorizedPage({
  params,
}: UnauthorizedPageProps): Promise<React.ReactElement> {
  await resolveRequestLocale(params);
  const t = await getTranslations("unauthorized");

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <p className="px-6 pb-6 text-sm">
        <Link href="/" className="underline underline-offset-4">
          {t("home")}
        </Link>
      </p>
    </Card>
  );
}
