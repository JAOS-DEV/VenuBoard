"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition, type ReactElement } from "react";

import {
  acceptInvitationAction,
  registerFromInvitation,
  updatePassword,
  type AuthActionResult,
} from "@/core/auth/actions";
import { InvitationMagicLinkButton } from "@/components/auth/auth-forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function invitationError(
  t: ReturnType<typeof useTranslations<"invite">>,
  result: AuthActionResult,
): string {
  switch (result.code) {
    case "email_mismatch":
      return t("emailMismatch");
    case "account_inactive":
      return t("accountInactive");
    case "membership_conflict":
      return t("membershipConflict");
    case "unauthenticated":
      return t("needSignIn");
    default:
      return t("unavailable");
  }
}

export function InvitationAcceptForm({
  token,
  signedIn,
}: {
  token: string;
  signedIn: boolean;
}): ReactElement {
  const t = useTranslations("invite");
  const tAuth = useTranslations("auth");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-6">
      {signedIn ? (
        <form
          action={(formData) => {
            formData.set("token", token);
            setError(null);
            startTransition(async () => {
              const result = await acceptInvitationAction(formData);
              if (!result.ok) {
                setError(invitationError(t, result));
              }
            });
          }}
        >
          {error !== null && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? tAuth("working") : t("accept")}
          </Button>
        </form>
      ) : (
        <>
          <form
            className="space-y-4"
            action={(formData) => {
              formData.set("token", token);
              setError(null);
              startTransition(async () => {
                const result = await registerFromInvitation(formData);
                if (!result.ok) {
                  setError(invitationError(t, result));
                }
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="invite-password">{tAuth("password")}</Label>
              <Input
                id="invite-password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={72}
                disabled={pending}
              />
            </div>
            {error !== null && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? tAuth("working") : t("createPassword")}
            </Button>
          </form>
          <InvitationMagicLinkButton token={token} />
        </>
      )}
    </div>
  );
}

export function UpdatePasswordForm(): ReactElement {
  const t = useTranslations("auth");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-4"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await updatePassword(formData);
          if (!result.ok) {
            setError(
              result.code === "validation_failed"
                ? t("validationFailed")
                : t("genericError"),
            );
          }
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="new-password">{t("newPassword")}</Label>
        <Input
          id="new-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          disabled={pending}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password">{t("confirmPassword")}</Label>
        <Input
          id="confirm-password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          disabled={pending}
        />
      </div>
      {error !== null && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t("working") : t("updatePassword")}
      </Button>
    </form>
  );
}
