import { describe, expect, it } from "vitest";

import {
  parseSafeApplicationPath,
  signInNavigationHref,
  toNavigationHref,
} from "@/core/auth/redirects";

describe("parseSafeApplicationPath", () => {
  it.each([
    "/",
    "/admin",
    "/platform",
    "/platform/onboard",
    "/platform/venues/00000000-0000-4000-8000-000000000201",
    "/en/admin",
    "/th/sign-in",
    "/invite/local-invite-atlas-editor-v1",
    "/v/harbor-light",
    "/update-password",
  ])("allows %s", (path) => {
    expect(parseSafeApplicationPath(path)).toBe(path);
  });

  it.each([
    "https://evil.example",
    "http://evil.example/admin",
    "http://localhost:3000/admin",
    "http://127.0.0.1:3000/admin",
    "//evil.example",
    "/\\evil.example",
    "///evil.example",
    "/en/admin?next=https://evil.example",
    "/en/admin#https://evil.example",
    "en/admin",
    "",
    "  ",
    "/..",
    "/../admin",
    "/en/../../admin",
    "javascript:alert(1)",
    "/en@evil.example",
    "/%2f%2fevil.example",
    "/%2FeviL",
    "/%5c%5cevil.example",
    "/%40evil.example",
    "/fr/admin",
    "https:evil.example",
    "/admin\n/platform",
    "/%252f%252fevil.example",
    "/%00admin",
    "/\tadmin",
    "/admin\u0000",
    "/\u2215evil",
    "/\uff0fevil",
    "/еn/admin",
    "/EN/admin",
    "/en%2f..%2f",
    "/./admin",
    "/admin/./settings",
    "/\\\\evil.example",
    "///evil.example/admin",
  ])("rejects %s", (path) => {
    expect(parseSafeApplicationPath(path)).toBeNull();
  });

  it("rejects non-strings", () => {
    expect(parseSafeApplicationPath(undefined)).toBeNull();
    expect(parseSafeApplicationPath(1)).toBeNull();
    expect(parseSafeApplicationPath({ path: "/admin" })).toBeNull();
  });
});

describe("toNavigationHref", () => {
  it("strips a locale prefix for next-intl", () => {
    expect(toNavigationHref("/en/admin")).toBe("/admin");
    expect(toNavigationHref("/th")).toBe("/");
    expect(toNavigationHref("/admin")).toBe("/admin");
  });
});

describe("signInNavigationHref", () => {
  it("omits next when there is no return path", () => {
    expect(signInNavigationHref(null)).toEqual({ pathname: "/sign-in" });
  });

  it("preserves a validated return path as a query value", () => {
    expect(signInNavigationHref("/admin")).toEqual({
      pathname: "/sign-in",
      query: { next: "/admin" },
    });
  });
});
