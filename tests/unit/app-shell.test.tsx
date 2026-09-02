import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import messages from "../../messages/en.json";

/**
 * `next-intl`'s navigation helpers depend on the Next.js App Router, which is
 * not mounted in jsdom. Swapping them for plain anchors keeps this a test of the
 * shell rather than a test of Next.js routing.
 */
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/auth/sign-out-button", () => ({
  SignOutButton: function SignOutButton() {
    return null;
  },
}));

vi.mock("@/core/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...props
  }: ComponentProps<"a"> & { href: string; locale?: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePathname: () => "/",
}));

const { AppShell } = await import("@/components/app-shell");

function renderShell(
  environment: ComponentProps<typeof AppShell>["environment"],
  developerHubEnabled = environment === "local",
): void {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AppShell
        environment={environment}
        signedIn={false}
        developerHubEnabled={developerHubEnabled}
      >
        <p>surface content</p>
      </AppShell>
    </NextIntlClientProvider>,
  );
}

describe("AppShell", () => {
  it("renders the product name, its children and a skip link", () => {
    renderShell("local");

    expect(screen.getByText("VenuBoard")).toBeInTheDocument();
    expect(screen.getByText("surface content")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: messages.shell.skipToContent }),
    ).toHaveAttribute("href", "#main");
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("states that local development is under active development", () => {
    renderShell("local");

    expect(screen.getByRole("status")).toHaveTextContent(
      messages.shell.localNotice,
    );
    expect(screen.getByRole("status")).not.toHaveTextContent(
      "product modules are not implemented",
    );
  });

  it("exposes the developer hub only for ordinary local development", () => {
    renderShell("local", true);
    expect(
      screen.getByRole("link", { name: messages.shell.developerHub }),
    ).toHaveAttribute("href", "/dev");
  });

  it("hides the developer hub outside local development", () => {
    renderShell("staging", false);
    expect(
      screen.queryByRole("link", { name: messages.shell.developerHub }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      messages.shell.stagingNotice,
    );
  });

  it("does not show a development-warning banner in production", () => {
    renderShell("production", false);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("links to each documented surface", () => {
    renderShell("local");

    const surfaces = screen.getByRole("navigation", {
      name: messages.shell.surfaces,
    });

    for (const href of ["/", "/v/harbor-light", "/admin", "/platform"]) {
      expect(
        surfaces.querySelector(`a[href="${href}"]`),
        `expected a link to ${href}`,
      ).not.toBeNull();
    }
  });

  it("shows the environment badge in local and staging", () => {
    renderShell("local");
    expect(screen.getByText("local")).toBeInTheDocument();
  });

  it("hides the environment badge in production", () => {
    renderShell("production");
    expect(screen.queryByText("production")).not.toBeInTheDocument();
  });

  it("offers both locales", () => {
    renderShell("local");

    const languageNav = screen.getByRole("navigation", {
      name: messages.shell.language,
    });

    expect(languageNav).toHaveTextContent("English");
    expect(languageNav).toHaveTextContent("ไทย");
  });
});
