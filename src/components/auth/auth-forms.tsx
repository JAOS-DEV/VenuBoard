"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition, type ReactElement } from "react";

import {
  requestInvitationMagicLink,
  requestPasswordReset,
  signInWithMagicLink,
  signInWithPassword,
  type AuthActionResult,
} from "@/core/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/core/i18n/navigation";

interface SignInFormProps {
  nextPath: string | null;
}

function messageFor(
  t: ReturnType<typeof useTranslations<"auth">>,
  result: AuthActionResult,
): string {
  if (result.info === "magic_link_sent") {
    return t("magicLinkSent");
  }
  if (result.code === "validation_failed") {
    return t("validationFailed");
  }
  if (result.code === "rate_limited") {
    return t("rateLimited");
  }
  if (result.code === "unavailable") {
    return t("unavailable");
  }
  return t("genericError");
}

export function SignInForm({ nextPath }: SignInFormProps): ReactElement {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(
    action: (formData: FormData) => Promise<AuthActionResult>,
    formData: FormData,
  ): void {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await action(formData);
      if (result.info !== undefined) {
        setNotice(messageFor(t, result));
        return;
      }
      if (!result.ok) {
        setError(messageFor(t, result));
      }
    });
  }

  return (
    <div className="space-y-8">
      <form
        className="space-y-4"
        action={(formData) => {
          formData.set("email", email);
          run(signInWithPassword, formData);
        }}
      >
        {nextPath !== null && (
          <input type="hidden" name="next" value={nextPath} />
        )}

        <div className="space-y-2">
          <Label htmlFor="email">{t("email")}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            disabled={pending}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">{t("password")}</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={72}
            disabled={pending}
          />
        </div>

        {error !== null && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {notice !== null && (
          <p role="status" className="text-sm text-muted-foreground">
            {notice}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? t("working") : t("signInPassword")}
        </Button>
      </form>

      <form
        className="space-y-4"
        action={(formData) => {
          formData.set("email", email);
          if (nextPath !== null) {
            formData.set("next", nextPath);
          }
          run(signInWithMagicLink, formData);
        }}
      >
        <Button
          type="submit"
          variant="outline"
          className="w-full"
          disabled={pending}
        >
          {pending ? t("working") : t("signInMagicLink")}
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">
        <Link href="/forgot-password" className="underline underline-offset-4">
          {t("forgotPassword")}
        </Link>
      </p>
    </div>
  );
}

export function ForgotPasswordForm(): ReactElement {
  const t = useTranslations("auth");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-4"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await requestPasswordReset(formData);
          if (result.ok) {
            setNotice(t("resetRequested"));
            return;
          }
          setError(
            result.code === "validation_failed"
              ? t("validationFailed")
              : t("genericError"),
          );
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="reset-email">{t("email")}</Label>
        <Input
          id="reset-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          disabled={pending}
        />
      </div>
      {error !== null && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {notice !== null && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t("working") : t("sendReset")}
      </Button>
    </form>
  );
}

export function InvitationMagicLinkButton({
  token,
}: {
  token: string;
}): ReactElement {
  const t = useTranslations("auth");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        formData.set("token", token);
        setError(null);
        startTransition(async () => {
          const result = await requestInvitationMagicLink(formData);
          if (result.ok) {
            setNotice(t("magicLinkSent"));
            return;
          }
          setError(t("genericError"));
        });
      }}
    >
      {error !== null && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {notice !== null && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}
      <Button
        type="submit"
        variant="outline"
        className="w-full"
        disabled={pending}
      >
        {pending ? t("working") : t("signInMagicLink")}
      </Button>
    </form>
  );
}
