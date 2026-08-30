import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "@/core/i18n/navigation";
import { resolveRequestLocale } from "@/core/i18n/server";

const SURFACE_LINKS = [
  { href: "/v/example-venue", key: "publicSite" },
  { href: "/admin", key: "admin" },
  { href: "/platform", key: "platform" },
] as const;

interface OverviewPageProps {
  params: Promise<{ locale: string }>;
}

export default async function OverviewPage({
  params,
}: OverviewPageProps): Promise<React.ReactElement> {
  await resolveRequestLocale(params);

  return <Overview />;
}

function Overview(): React.ReactElement {
  const t = useTranslations("home");
  const tNav = useTranslations("nav");

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="max-w-2xl text-muted-foreground">{t("description")}</p>
      </header>

      <section className="space-y-4">
        <p className="max-w-2xl text-sm text-muted-foreground">
          {t("surfacesDescription")}
        </p>

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SURFACE_LINKS.map((surface) => (
            <li key={surface.href}>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="text-base">
                    {tNav(surface.key)}
                  </CardTitle>
                  <CardDescription>{surface.href}</CardDescription>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <p className="max-w-2xl text-sm text-muted-foreground">
          {t("nextStep")}
        </p>
        <Button asChild variant="outline">
          <Link href="/v/example-venue">{t("exampleSlug")}</Link>
        </Button>
      </section>
    </div>
  );
}
