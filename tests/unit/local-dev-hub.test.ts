import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { isTestIdentityEnabled } from "@/core/auth/test-identity";
import { isOrdinaryLocalDevelopment } from "@/core/dev/guard";
import {
  DEVELOPER_PERSONAS,
  resolveDeveloperPersona,
} from "@/core/dev/personas";
import { resolveSignInPrefill } from "@/core/dev/prefill";

const SEED_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../supabase/seed/01_foundation.sql",
);

const SECRET_FIELD = /password|passwd|secret|token|key|jwt|service.?role/i;

describe("ordinary local-development guard", () => {
  it("allows only VENUBOARD_ENV=local with a non-production Node mode", () => {
    expect(isOrdinaryLocalDevelopment("local", "development")).toBe(true);
    expect(isOrdinaryLocalDevelopment("local", "test")).toBe(true);
    expect(isOrdinaryLocalDevelopment("local", undefined)).toBe(true);
  });

  it.each([
    ["test", "development"],
    ["staging", "development"],
    ["production", "development"],
    ["preview", "development"],
    [undefined, "development"],
    ["", "development"],
    ["LOCAL", "development"],
    ["local", "production"],
  ] as const)(
    "denies environment %s with NODE_ENV %s",
    (environment, nodeEnv) => {
      expect(isOrdinaryLocalDevelopment(environment, nodeEnv)).toBe(false);
    },
  );

  it("does not overlap the Playwright test-identity triple gate", () => {
    expect(isOrdinaryLocalDevelopment("local", "development")).toBe(true);
    expect(isTestIdentityEnabled("local", "development", true)).toBe(false);
    expect(isOrdinaryLocalDevelopment("test", "development")).toBe(false);
    expect(isTestIdentityEnabled("test", "development", true)).toBe(true);
    expect(isTestIdentityEnabled("test", "production", true)).toBe(false);
    expect(isTestIdentityEnabled("test", "development", false)).toBe(false);
  });
});

describe("developer personas", () => {
  it("resolves only allowlisted identifiers", () => {
    expect(resolveDeveloperPersona("platform-admin")?.email).toBe(
      "platform.admin@example.com",
    );
    expect(resolveDeveloperPersona("harbor-owner")?.email).toBe(
      "harbor.owner@example.com",
    );
    expect(resolveDeveloperPersona("not-a-persona")).toBeNull();
    expect(resolveDeveloperPersona("platform.admin@example.com")).toBeNull();
    expect(resolveDeveloperPersona(undefined)).toBeNull();
  });

  it("defaults platform identities to /platform and venue identities to /admin", () => {
    expect(resolveDeveloperPersona("platform-admin")?.destination).toBe(
      "/platform",
    );
    expect(resolveDeveloperPersona("platform-support")?.destination).toBe(
      "/platform",
    );
    expect(resolveDeveloperPersona("harbor-owner")?.destination).toBe("/admin");
    expect(resolveDeveloperPersona("atlas-owner")?.destination).toBe("/admin");
    expect(resolveDeveloperPersona("deactivated-user")?.destination).toBe(
      "/admin",
    );
  });

  it("does not store password, key or token fields", () => {
    for (const persona of DEVELOPER_PERSONAS) {
      for (const key of Object.keys(persona)) {
        expect(key).not.toMatch(SECRET_FIELD);
      }
    }
  });

  it("lists emails that exist in the deterministic seed with matching roles", () => {
    const seed = readFileSync(SEED_PATH, "utf8");
    const seededEmails = [
      ...seed.matchAll(/seed_auth_user\([^,]+,\s*'([^']+@example\.com)'/g),
    ].map((match) => match[1]);

    for (const persona of DEVELOPER_PERSONAS) {
      expect(seededEmails).toContain(persona.email);
    }

    expect(seed).toContain("platform_admin");
    expect(seed).toContain("platform_support");
    expect(seed).toMatch(/harbor_owner_id,\s*'business_owner'/);
    expect(seed).toMatch(/atlas_owner_id,\s*'business_owner'/);
    expect(seed).toMatch(/manager_id,\s*'venue_manager'/);
    expect(seed).toMatch(/editor_id,\s*'content_editor'/);
    expect(seed).toMatch(/booking_id,\s*'booking_manager'/);
    expect(seed).toMatch(/staff_id,\s*'staff'/);
    expect(seed).toMatch(/dual_staff_id,\s*'staff'/);
    expect(seed).toMatch(
      /account_status = 'deactivated'[\s\S]*deactivated_id|deactivated_id[\s\S]*account_status = 'deactivated'/,
    );
    expect(seed).toMatch(/harbor_owner_id,\s*'staff'/);
  });
});

describe("sign-in prefill", () => {
  it("prefills only through the allowlist under the local guard", () => {
    expect(
      resolveSignInPrefill({
        enabled: true,
        personaId: "platform-admin",
        nextRaw: null,
      }),
    ).toEqual({
      email: "platform.admin@example.com",
      nextPath: "/platform",
    });

    expect(
      resolveSignInPrefill({
        enabled: true,
        personaId: "harbor-owner",
        nextRaw: null,
      }),
    ).toEqual({
      email: "harbor.owner@example.com",
      nextPath: "/admin",
    });
  });

  it("does not prefill an unknown persona", () => {
    expect(
      resolveSignInPrefill({
        enabled: true,
        personaId: "unknown-persona",
        nextRaw: "/admin",
      }),
    ).toEqual({
      email: null,
      nextPath: "/admin",
    });
  });

  it("ignores the persona parameter outside ordinary local development", () => {
    expect(
      resolveSignInPrefill({
        enabled: false,
        personaId: "platform-admin",
        nextRaw: "/admin",
      }),
    ).toEqual({
      email: null,
      nextPath: "/admin",
    });
  });

  it("preserves only a validated return path", () => {
    expect(
      resolveSignInPrefill({
        enabled: true,
        personaId: "platform-admin",
        nextRaw: "/admin",
      }).nextPath,
    ).toBe("/admin");

    expect(
      resolveSignInPrefill({
        enabled: true,
        personaId: "platform-admin",
        nextRaw: "https://evil.example",
      }).nextPath,
    ).toBe("/platform");

    expect(
      resolveSignInPrefill({
        enabled: false,
        personaId: "platform-admin",
        nextRaw: "https://evil.example",
      }).nextPath,
    ).toBeNull();
  });
});
