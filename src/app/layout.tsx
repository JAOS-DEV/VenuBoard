import type { ReactNode } from "react";

/**
 * Root layout required by the App Router.
 *
 * `html` and `body` live on the `[locale]` layout so `lang` matches the active
 * locale. This file only forwards children — the next-intl App Router pattern.
 */
export default function RootLayout({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return children;
}
