"use server";

import { headers } from "next/headers";
import { getLocale } from "next-intl/server";

import {
  normalizeAuthError,
  normalizeInvitationAcceptCode,
} from "@/core/auth/errors";
import { authCallbackUrl, resolveAppOrigin } from "@/core/auth/origin";
import {
  forgotPasswordSchema,
  registerFromInvitationSchema,
  signInMagicLinkSchema,
  signInPasswordSchema,
  updatePasswordSchema,
} from "@/core/auth/passwords";
import {
  parseSafeApplicationPath,
  toNavigationHref,
  type SafeApplicationPath,
} from "@/core/auth/redirects";
import { getSupabaseConnection } from "@/core/db/connection";
import { createSupabaseServerClient } from "@/core/db/server-client";
import { redirect } from "@/core/i18n/navigation";
import type { AppLocale } from "@/core/i18n/routing";
import { inspectInvitation } from "@/core/auth/inspect-invitation";
import { isPlausibleInvitationToken } from "@/core/auth/invitation-links";

export interface AuthActionResult {
  ok: boolean;
  code?: string;
  info?: string;
}

function localeOrDefault(value: string): AppLocale {
  return value === "th" ? "th" : "en";
}

function safeNext(raw: FormDataEntryValue | null): SafeApplicationPath | null {
  return parseSafeApplicationPath(typeof raw === "string" ? raw : null);
}

function invitationReturnPath(token: string): SafeApplicationPath | null {
  if (!isPlausibleInvitationToken(token)) {
    return null;
  }
  return parseSafeApplicationPath(`/invite/${token}`);
}

async function callbackTarget(
  nextPath: SafeApplicationPath | null,
): Promise<string | null> {
  const headerStore = await headers();
  const origin = resolveAppOrigin(headerStore.get("origin"));
  if (origin === null) {
    return null;
  }
  const locale = localeOrDefault(await getLocale());
  return authCallbackUrl(origin, locale, nextPath);
}

export async function signInWithPassword(
  formData: FormData,
): Promise<AuthActionResult> {
  const parsed = signInPasswordSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, code: "validation_failed" };
  }

  if (getSupabaseConnection() === null) {
    return { ok: false, code: "unavailable" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { ok: false, code: normalizeAuthError(error) };
  }

  const locale = localeOrDefault(await getLocale());
  const nextPath = safeNext(formData.get("next")) ?? "/admin";
  redirect({ href: toNavigationHref(nextPath), locale });
  return { ok: true };
}

export async function signInWithMagicLink(
  formData: FormData,
): Promise<AuthActionResult> {
  const parsed = signInMagicLinkSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { ok: false, code: "validation_failed" };
  }

  if (getSupabaseConnection() === null) {
    return { ok: false, code: "unavailable" };
  }

  const emailRedirectTo = await callbackTarget(safeNext(formData.get("next")));
  if (emailRedirectTo === null) {
    return { ok: false, code: "unavailable" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo,
    },
  });

  if (error) {
    return { ok: false, code: normalizeAuthError(error) };
  }

  return { ok: true, info: "magic_link_sent" };
}

export async function requestPasswordReset(
  formData: FormData,
): Promise<AuthActionResult> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { ok: false, code: "validation_failed" };
  }

  if (getSupabaseConnection() === null) {
    return { ok: false, code: "unavailable" };
  }

  const headerStore = await headers();
  const origin = resolveAppOrigin(headerStore.get("origin"));
  const locale = localeOrDefault(await getLocale());
  if (origin === null) {
    return { ok: false, code: "unavailable" };
  }

  const nextPath = parseSafeApplicationPath("/update-password");
  if (nextPath === null) {
    return { ok: false, code: "unavailable" };
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: authCallbackUrl(origin, locale, nextPath),
  });

  return { ok: true, info: "reset_requested" };
}

export async function updatePassword(
  formData: FormData,
): Promise<AuthActionResult> {
  const parsed = updatePasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { ok: false, code: "validation_failed" };
  }

  if (getSupabaseConnection() === null) {
    return { ok: false, code: "unavailable" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { ok: false, code: normalizeAuthError(error) };
  }

  const locale = localeOrDefault(await getLocale());
  redirect({ href: "/admin", locale });
  return { ok: true };
}

export async function signOut(): Promise<void> {
  if (getSupabaseConnection() !== null) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }

  const locale = localeOrDefault(await getLocale());
  redirect({ href: "/", locale });
}

export async function registerFromInvitation(
  formData: FormData,
): Promise<AuthActionResult> {
  const parsed = registerFromInvitationSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, code: "validation_failed" };
  }

  const inspection = await inspectInvitation(parsed.data.token);
  if (inspection.status !== "pending" || inspection.email === null) {
    return { ok: false, code: "invitation_unavailable" };
  }

  if (getSupabaseConnection() === null) {
    return { ok: false, code: "unavailable" };
  }

  const emailRedirectTo = await callbackTarget(
    invitationReturnPath(parsed.data.token),
  );
  if (emailRedirectTo === null) {
    return { ok: false, code: "unavailable" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email: inspection.email,
    password: parsed.data.password,
    options: { emailRedirectTo },
  });

  if (error) {
    return { ok: false, code: normalizeAuthError(error) };
  }

  const accepted = await acceptInvitationForCurrentUser(parsed.data.token);
  if (!accepted.ok) {
    return accepted;
  }

  const locale = localeOrDefault(await getLocale());
  redirect({ href: "/admin", locale });
  return { ok: true };
}

export async function requestInvitationMagicLink(
  formData: FormData,
): Promise<AuthActionResult> {
  const token =
    typeof formData.get("token") === "string"
      ? (formData.get("token") as string)
      : "";
  if (!isPlausibleInvitationToken(token)) {
    return { ok: false, code: "invitation_unavailable" };
  }
  const inspection = await inspectInvitation(token);
  if (inspection.status !== "pending" || inspection.email === null) {
    return { ok: false, code: "invitation_unavailable" };
  }

  if (getSupabaseConnection() === null) {
    return { ok: false, code: "unavailable" };
  }

  const emailRedirectTo = await callbackTarget(invitationReturnPath(token));
  if (emailRedirectTo === null) {
    return { ok: false, code: "unavailable" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: inspection.email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo,
    },
  });

  if (error) {
    return { ok: false, code: normalizeAuthError(error) };
  }

  return { ok: true, info: "magic_link_sent" };
}

export async function acceptInvitationAction(
  formData: FormData,
): Promise<AuthActionResult> {
  const token =
    typeof formData.get("token") === "string"
      ? (formData.get("token") as string)
      : "";
  return acceptInvitationForCurrentUser(token);
}

async function acceptInvitationForCurrentUser(
  token: string,
): Promise<AuthActionResult> {
  if (!isPlausibleInvitationToken(token)) {
    return { ok: false, code: "invitation_unavailable" };
  }

  if (getSupabaseConnection() === null) {
    return { ok: false, code: "unavailable" };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("accept_invitation", {
    p_token: token,
  });

  if (error) {
    return { ok: false, code: normalizeAuthError(error) };
  }

  if (
    data !== null &&
    typeof data === "object" &&
    "ok" in data &&
    data.ok === true
  ) {
    const locale = localeOrDefault(await getLocale());
    redirect({ href: "/admin", locale });
    return { ok: true };
  }

  const code =
    data !== null &&
    typeof data === "object" &&
    "code" in data &&
    typeof data.code === "string"
      ? data.code
      : "invitation_unavailable";

  return { ok: false, code: normalizeInvitationAcceptCode(code) };
}
