import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import messages from "../../messages/en.json";

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
}));

const signInWithMagicLink = vi.fn();
const signInWithPassword = vi.fn();

vi.mock("@/core/auth/actions", () => ({
  signInWithMagicLink: (...args: unknown[]) => signInWithMagicLink(...args),
  signInWithPassword: (...args: unknown[]) => signInWithPassword(...args),
  requestInvitationMagicLink: vi.fn(),
  requestPasswordReset: vi.fn(),
}));

const { SignInForm } = await import("@/components/auth/auth-forms");

function renderSignIn(props: ComponentProps<typeof SignInForm>): void {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <SignInForm {...props} />
    </NextIntlClientProvider>,
  );
}

describe("SignInForm local development assistance", () => {
  it("prefills an allowlisted email and never a password", () => {
    renderSignIn({
      nextPath: "/platform",
      initialEmail: "platform.admin@example.com",
      localDevelopmentAssistance: true,
      mailboxUrl: "http://127.0.0.1:54324",
    });

    expect(screen.getByLabelText("Email address")).toHaveValue(
      "platform.admin@example.com",
    );
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(
      screen.getByRole("link", { name: messages.auth.openDeveloperHub }),
    ).toHaveAttribute("href", "/dev");
    expect(
      screen.queryByRole("link", { name: messages.auth.openLocalMailbox }),
    ).not.toBeInTheDocument();
  });

  it("links to the local mailbox only after a successful magic-link request", async () => {
    const user = userEvent.setup();
    signInWithMagicLink.mockResolvedValue({
      ok: true,
      info: "magic_link_sent",
    });

    renderSignIn({
      nextPath: "/admin",
      initialEmail: "harbor.owner@example.com",
      localDevelopmentAssistance: true,
      mailboxUrl: "http://127.0.0.1:54324",
    });

    await user.click(
      screen.getByRole("button", { name: messages.auth.signInMagicLink }),
    );

    expect(
      await screen.findByText(messages.auth.magicLinkSent),
    ).toBeInTheDocument();
    expect(
      screen.getByText(messages.auth.magicLinkLocalFollowUp),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: messages.auth.openLocalMailbox }),
    ).toHaveAttribute("href", "http://127.0.0.1:54324");
  });

  it("does not claim a mailbox follow-up when the request fails", async () => {
    const user = userEvent.setup();
    signInWithMagicLink.mockResolvedValue({
      ok: false,
      code: "unavailable",
    });

    renderSignIn({
      nextPath: null,
      localDevelopmentAssistance: true,
      mailboxUrl: "http://127.0.0.1:54324",
    });

    await user.type(
      screen.getByLabelText("Email address"),
      "anyone@example.com",
    );
    await user.click(
      screen.getByRole("button", { name: messages.auth.signInMagicLink }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      messages.auth.unavailable,
    );
    expect(
      screen.queryByText(messages.auth.magicLinkLocalFollowUp),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: messages.auth.openLocalMailbox }),
    ).not.toBeInTheDocument();
  });

  it("hides local assistance outside ordinary local development", async () => {
    const user = userEvent.setup();
    signInWithMagicLink.mockResolvedValue({
      ok: true,
      info: "magic_link_sent",
    });

    renderSignIn({
      nextPath: "/platform",
      initialEmail: null,
      localDevelopmentAssistance: false,
    });

    await user.type(
      screen.getByLabelText("Email address"),
      "platform.admin@example.com",
    );
    await user.click(
      screen.getByRole("button", { name: messages.auth.signInMagicLink }),
    );

    expect(
      await screen.findByText(messages.auth.magicLinkSent),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: messages.auth.openDeveloperHub }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(messages.auth.magicLinkLocalFollowUp),
    ).not.toBeInTheDocument();
  });
});
