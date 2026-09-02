import { getTranslations } from "next-intl/server";

import { CopyEmailButton } from "@/components/dev/copy-email-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  developerHubSignInHref,
  type DeveloperPersonaGroup,
  type DeveloperPersonaView,
} from "@/core/dev/personas";
import { LOCAL_SERVICE_LINKS } from "@/core/dev/services";
import { Link } from "@/core/i18n/navigation";

const PERSONA_GROUPS: readonly DeveloperPersonaGroup[] = [
  "platform",
  "venue",
  "denied",
];

interface DeveloperHubProps {
  personas: readonly DeveloperPersonaView[];
}

export async function DeveloperHub({
  personas,
}: DeveloperHubProps): Promise<React.ReactElement> {
  const t = await getTranslations("dev");

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="max-w-2xl text-muted-foreground">{t("description")}</p>
      </header>

      <section className="space-y-4" aria-labelledby="local-services-heading">
        <h2
          id="local-services-heading"
          className="text-lg font-semibold tracking-tight"
        >
          {t("services")}
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {t("servicesHelp")}
        </p>
        <ul className="grid gap-4 sm:grid-cols-2">
          {LOCAL_SERVICE_LINKS.map((service) => (
            <li key={service.id}>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="text-base">
                    {t(`serviceLabels.${service.id}`)}
                  </CardTitle>
                  <CardDescription>{service.href}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline">
                    <a href={service.href} target="_blank" rel="noreferrer">
                      {t("openLocalTool")}
                    </a>
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
          <li>
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-base">
                  {t("signInEnglish")}
                </CardTitle>
                <CardDescription>{t("signInEnglishHelp")}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline">
                  <Link href="/sign-in" locale="en">
                    {t("openSignIn")}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </li>
          <li>
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-base">{t("signInThai")}</CardTitle>
                <CardDescription>{t("signInThaiHelp")}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline">
                  <Link href="/sign-in" locale="th">
                    {t("openSignIn")}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </li>
        </ul>
      </section>

      <section className="space-y-6" aria-labelledby="personas-heading">
        <div className="space-y-2">
          <h2
            id="personas-heading"
            className="text-lg font-semibold tracking-tight"
          >
            {t("personas")}
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t("personasHelp")}
          </p>
        </div>

        {PERSONA_GROUPS.map((group) => {
          const groupPersonas = personas.filter(
            (persona) => persona.group === group,
          );

          return (
            <div key={group} className="space-y-3">
              <h3 className="text-base font-medium">{t(`groups.${group}`)}</h3>
              <ul className="grid gap-4">
                {groupPersonas.map((persona) => (
                  <li key={persona.id}>
                    <PersonaCard persona={persona} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>
    </div>
  );
}

async function PersonaCard({
  persona,
}: {
  persona: DeveloperPersonaView;
}): Promise<React.ReactElement> {
  const t = await getTranslations("dev");

  return (
    <Card>
      <CardHeader>
        <h3 className="text-base font-semibold leading-tight">
          {t(`catalog.${persona.id}.label`)}
        </h3>
        <CardDescription>{persona.email}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">{t("role")}</dt>
            <dd>{t(`catalog.${persona.id}.role`)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("destination")}</dt>
            <dd>{persona.destination}</dd>
          </div>
        </dl>
        <p className="text-sm text-muted-foreground">
          {t(`catalog.${persona.id}.purpose`)}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <CopyEmailButton
            email={persona.email}
            label={t("copyEmail")}
            copiedLabel={t("emailCopied")}
          />
          <Button asChild>
            <Link href={developerHubSignInHref(persona)}>
              {t("openSignIn")}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
