import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";

import { ThemeProvider } from "@/core/theme/theme-provider";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
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

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          <NextIntlClientProvider>{children}</NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
