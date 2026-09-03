import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  authCallbackUrl,
  CANONICAL_LOCAL_APP_ORIGIN,
  resolveAppOriginFrom,
  resolveCallbackRedirectOriginFrom,
  type AppOriginEnv,
} from "@/core/auth/app-origin";
import {
  LOCAL_APP_URL,
  LOCAL_AUTH_HEALTH_URL,
  LOCAL_MAILBOX_URL,
  LOCAL_STUDIO_URL,
} from "@/core/dev/services";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const CONFIG_PATH = join(ROOT, "supabase", "config.toml");
const CALLBACK_ROUTE_PATH = join(
  ROOT,
  "src",
  "app",
  "[locale]",
  "auth",
  "callback",
  "route.ts",
);
const PLAYWRIGHT_CONFIG_PATH = join(ROOT, "playwright.config.ts");

const LOCAL_ENV: AppOriginEnv = { VENUBOARD_ENV: "local" };

function uncommentedLines(source: string): string {
  return source
    .split(/\n/)
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n");
}

function quotedStrings(block: string): string[] {
  return [...block.matchAll(/"([^"]*)"/g)].map((match) => match[1] ?? "");
}

function parseAuthRedirectConfig(source: string): {
  siteUrl: string;
  redirects: string[];
} {
  const active = uncommentedLines(source);
  const siteUrlMatch = /site_url\s*=\s*"([^"]+)"/.exec(active);
  const redirectMatch = /additional_redirect_urls\s*=\s*\[([\s\S]*?)\]/.exec(
    active,
  );

  if (siteUrlMatch?.[1] === undefined || redirectMatch?.[1] === undefined) {
    throw new Error("supabase/config.toml is missing Auth redirect settings.");
  }

  return {
    siteUrl: siteUrlMatch[1],
    redirects: quotedStrings(redirectMatch[1]),
  };
}

describe("local Auth origin", () => {
  const config = readFileSync(CONFIG_PATH, "utf8");
  const { siteUrl, redirects } = parseAuthRedirectConfig(config);

  it("uses the canonical localhost app origin as site_url", () => {
    expect(CANONICAL_LOCAL_APP_ORIGIN).toBe("http://localhost:3000");
    expect(LOCAL_APP_URL).toBe(CANONICAL_LOCAL_APP_ORIGIN);
    expect(siteUrl).toBe(CANONICAL_LOCAL_APP_ORIGIN);
  });

  it("allowlists English and Thai localhost callbacks", () => {
    expect(redirects).toContain(
      `${CANONICAL_LOCAL_APP_ORIGIN}/en/auth/callback`,
    );
    expect(redirects).toContain(
      `${CANONICAL_LOCAL_APP_ORIGIN}/th/auth/callback`,
    );
  });

  it("keeps Playwright callback origins on ports 3100 and 3101", () => {
    const playwrightConfig = readFileSync(PLAYWRIGHT_CONFIG_PATH, "utf8");
    expect(playwrightConfig).toContain("const TEST_PORT = 3100");
    expect(playwrightConfig).toContain("const LOCAL_DEV_PORT = 3101");

    for (const origin of ["http://127.0.0.1:3100", "http://127.0.0.1:3101"]) {
      expect(redirects).toContain(`${origin}/en/auth/callback`);
      expect(redirects).toContain(`${origin}/th/auth/callback`);
    }
  });

  it("does not keep a 127.0.0.1:3000 application origin or https redirect", () => {
    const active = uncommentedLines(config);
    expect(active).not.toMatch(/https?:\/\/127\.0\.0\.1:3000/);
    expect(config).not.toMatch(/https:\/\/127\.0\.0\.1:3000/);
    expect(readFileSync(CALLBACK_ROUTE_PATH, "utf8")).not.toMatch(
      /127\.0\.0\.1:3000/,
    );
    expect(redirects.join("\n")).not.toMatch(/127\.0\.0\.1:3000/);
  });

  it("does not broaden Auth redirects with wildcards or arbitrary ports", () => {
    expect(redirects).toEqual([
      `${CANONICAL_LOCAL_APP_ORIGIN}/en/auth/callback`,
      `${CANONICAL_LOCAL_APP_ORIGIN}/th/auth/callback`,
      "http://127.0.0.1:3100/en/auth/callback",
      "http://127.0.0.1:3100/th/auth/callback",
      "http://127.0.0.1:3101/en/auth/callback",
      "http://127.0.0.1:3101/th/auth/callback",
    ]);
    for (const url of redirects) {
      expect(url).not.toContain("*");
    }
  });

  it("keeps Supabase API, Studio and mailbox on 127.0.0.1 service ports", () => {
    expect(LOCAL_AUTH_HEALTH_URL).toBe("http://127.0.0.1:54321/auth/v1/health");
    expect(LOCAL_STUDIO_URL).toBe("http://127.0.0.1:54323");
    expect(LOCAL_MAILBOX_URL).toBe("http://127.0.0.1:54324");
    expect(uncommentedLines(config)).toMatch(/port\s*=\s*54321/);
    expect(uncommentedLines(config)).toMatch(/port\s*=\s*54323/);
    expect(uncommentedLines(config)).toMatch(/port\s*=\s*54324/);
  });
});

describe("resolveAppOriginFrom", () => {
  it("defaults local-class requests to the canonical localhost origin", () => {
    expect(resolveAppOriginFrom(LOCAL_ENV, null)).toBe(
      CANONICAL_LOCAL_APP_ORIGIN,
    );
    expect(resolveAppOriginFrom(LOCAL_ENV, "http://localhost:3000")).toBe(
      CANONICAL_LOCAL_APP_ORIGIN,
    );
    expect(resolveAppOriginFrom({ VENUBOARD_ENV: "test" }, null)).toBe(
      CANONICAL_LOCAL_APP_ORIGIN,
    );
  });

  it("rejects the obsolete 127.0.0.1:3000 application origin", () => {
    expect(resolveAppOriginFrom(LOCAL_ENV, "http://127.0.0.1:3000")).toBeNull();
    expect(
      resolveCallbackRedirectOriginFrom(
        LOCAL_ENV,
        "http://127.0.0.1:3000/en/auth/callback",
      ),
    ).toBe(CANONICAL_LOCAL_APP_ORIGIN);
  });

  it("does not accept arbitrary ports, hosts or production fallbacks", () => {
    expect(resolveAppOriginFrom(LOCAL_ENV, "http://localhost:3001")).toBeNull();
    expect(resolveAppOriginFrom(LOCAL_ENV, "http://localhost:3100")).toBeNull();
    expect(resolveAppOriginFrom(LOCAL_ENV, "https://evil.example")).toBeNull();
    expect(
      resolveAppOriginFrom({ VENUBOARD_ENV: "production" }, null),
    ).toBeNull();
    expect(
      resolveAppOriginFrom(
        { VENUBOARD_ENV: "staging" },
        "http://localhost:3000",
      ),
    ).toBeNull();
  });

  it("lets an explicit NEXT_PUBLIC_APP_ORIGIN win for Playwright", () => {
    expect(
      resolveAppOriginFrom(
        {
          VENUBOARD_ENV: "test",
          NEXT_PUBLIC_APP_ORIGIN: "http://127.0.0.1:3100",
        },
        "http://localhost:3000",
      ),
    ).toBe("http://127.0.0.1:3100");
  });
});

describe("authCallbackUrl", () => {
  it("builds same-origin English and Thai callbacks", () => {
    expect(authCallbackUrl(CANONICAL_LOCAL_APP_ORIGIN, "en", "/platform")).toBe(
      "http://localhost:3000/en/auth/callback?next=%2Fplatform",
    );
    expect(authCallbackUrl(CANONICAL_LOCAL_APP_ORIGIN, "th", null)).toBe(
      "http://localhost:3000/th/auth/callback",
    );
  });
});
