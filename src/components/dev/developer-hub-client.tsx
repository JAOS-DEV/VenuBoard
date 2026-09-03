"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { CopyEmailButton } from "@/components/dev/copy-email-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  developerHubSignInHref,
  type DeveloperPersonaGroup,
  type DeveloperPersonaView,
} from "@/core/dev/personas";
import { LOCAL_SERVICE_LINKS } from "@/core/dev/services";
import { Link } from "@/core/i18n/navigation";
import { PageHeader } from "@/components/patterns/page-header";

const PERSONA_GROUPS: readonly DeveloperPersonaGroup[] = [
  "platform",
  "venue",
  "denied",
];

interface DeveloperHubClientProps {
  personas: readonly DeveloperPersonaView[];
  services: readonly (typeof LOCAL_SERVICE_LINKS)[number][];
}

export function DeveloperHubClient({
  personas,
  services,
}: DeveloperHubClientProps): React.ReactElement {
  const t = useTranslations("dev");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) {
      return personas;
    }
    return personas.filter((persona) => {
      const label = t(`catalog.${persona.id}.label`).toLowerCase();
      return (
        persona.email.toLowerCase().includes(needle) ||
        persona.id.toLowerCase().includes(needle) ||
        label.includes(needle)
      );
    });
  }, [personas, query, t]);

  return (
    <div className="space-y-5">
      <PageHeader title={t("title")} description={t("description")} />

      <Tabs defaultValue="accounts">
        <TabsList>
          <TabsTrigger value="accounts">{t("accounts")}</TabsTrigger>
          <TabsTrigger value="services">{t("services")}</TabsTrigger>
          <TabsTrigger value="commands">{t("commands")}</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              placeholder={t("searchPersonas")}
              aria-label={t("searchPersonas")}
              className="ps-10"
            />
          </div>
          {PERSONA_GROUPS.map((group) => {
            const groupPersonas = filtered.filter(
              (persona) => persona.group === group,
            );
            if (groupPersonas.length === 0) {
              return null;
            }
            return (
              <section key={group} className="space-y-2">
                <h2 className="text-sm font-semibold">
                  {t(`groups.${group}`)}
                </h2>
                <ul className="space-y-2">
                  {groupPersonas.map((persona) => (
                    <li key={persona.id}>
                      <PersonaRow persona={persona} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </TabsContent>

        <TabsContent value="services">
          <p className="mb-3 text-sm text-muted-foreground">
            {t("servicesHelp")}
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {services.map((service) => (
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
          </ul>
        </TabsContent>

        <TabsContent value="commands">
          <ul className="grid gap-3 sm:grid-cols-2">
            <li>
              <Card>
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
              <Card>
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
            <li>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("uiGallery")}</CardTitle>
                  <CardDescription>{t("uiGalleryHelp")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild>
                    <Link href="/dev/ui">{t("uiGallery")}</Link>
                  </Button>
                </CardContent>
              </Card>
            </li>
          </ul>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PersonaRow({
  persona,
}: {
  persona: DeveloperPersonaView;
}): React.ReactElement {
  const t = useTranslations("dev");
  const deactivated = persona.group === "denied";

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold leading-tight">
              {t(`catalog.${persona.id}.label`)}
            </h3>
            <Badge variant={deactivated ? "disabled" : "secondary"}>
              {t(`catalog.${persona.id}.role`)}
            </Badge>
            {deactivated ? (
              <Badge variant="disabled">{t("deactivated")}</Badge>
            ) : null}
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {persona.email}
          </p>
          <p className="text-sm text-muted-foreground">
            {t(`catalog.${persona.id}.purpose`)}
          </p>
          <details>
            <summary className="flex h-11 cursor-pointer items-center text-sm">
              {t("technicalDetails")}
            </summary>
            <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">{t("role")}</dt>
                <dd>{t(`catalog.${persona.id}.role`)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("destination")}</dt>
                <dd>{persona.destination}</dd>
              </div>
            </dl>
          </details>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
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
