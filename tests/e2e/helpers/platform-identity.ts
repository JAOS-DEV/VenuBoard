import { randomBytes } from "node:crypto";

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import type { Browser, BrowserContext, Page } from "@playwright/test";

const PLATFORM_ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const PLATFORM_ADMIN_EMAIL = "platform.admin@example.com";

export interface PlatformAdminSignIn {
  ok: boolean;
  email: string;
  password: string;
}

export async function openWithTestIdentity(
  browser: Browser,
  baseURL: string | undefined,
  token: "platform-admin" | "platform-support" | "authenticated-no-access",
): Promise<{ context: BrowserContext; page: Page }> {
  if (baseURL === undefined) {
    throw new Error(
      "Playwright baseURL is required for the test identity cookie",
    );
  }

  const context = await browser.newContext({ baseURL });
  await context.addCookies([
    {
      name: "vb_test_identity",
      value: token,
      url: baseURL,
    },
  ]);
  const page = await context.newPage();
  return { context, page };
}

export async function signInPlatformAdmin(
  page: Page,
): Promise<PlatformAdminSignIn> {
  loadEnvConfig(process.cwd());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  const failed: PlatformAdminSignIn = {
    ok: false,
    email: PLATFORM_ADMIN_EMAIL,
    password: "",
  };
  if (
    url === undefined ||
    url.length === 0 ||
    secret === undefined ||
    secret.length === 0
  ) {
    return failed;
  }

  const password = `E2e-${randomBytes(12).toString("base64url")}`;
  const admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await admin.auth.admin.updateUserById(PLATFORM_ADMIN_ID, {
    password,
  });
  if (error !== null) {
    return failed;
  }

  await page.goto("/en/sign-in");
  await page.getByLabel("Email address").fill(PLATFORM_ADMIN_EMAIL);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in with password" }).click();
  try {
    await page.getByRole("button", { name: "Sign out" }).waitFor({
      timeout: 15_000,
    });
    return { ok: true, email: PLATFORM_ADMIN_EMAIL, password };
  } catch {
    return failed;
  }
}
