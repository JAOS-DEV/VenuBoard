import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";

import { AppShell } from "@/components/app-shell";
import { headerIdentity, resolveRequestActor } from "@/core/actors/resolve";
import { isOrdinaryLocalDevelopment } from "@/core/dev/guard";
import { serverEnv } from "@/core/env/server";
import { routing } from "@/core/i18n/routing";
import { resolveRequestLocale } from "@/core/i18n/server";

import "../globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "VenuBoard",
  description:
    "VenuBoard venue platform. Remaining product modules are later work.",
  robots: { index: false, follow: false },
};

export function generateStaticParams(): Array<{ locale: string }> {
  return routing.locales.map((locale) => ({ locale }));
}

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps): Promise<React.ReactElement> {
  const locale = await resolveRequestLocale(params);
  const actor = await resolveRequestActor({ memberships: "none" });
  const session = headerIdentity(actor);

  return (
    <html lang={locale}>
      <body className="antialiased">
        <NextIntlClientProvider>
          <AppShell
            environment={serverEnv.VENUBOARD_ENV}
            signedIn={session.signedIn}
            developerHubEnabled={isOrdinaryLocalDevelopment(
              serverEnv.VENUBOARD_ENV,
              process.env.NODE_ENV,
            )}
          >
            {children}
          </AppShell>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
