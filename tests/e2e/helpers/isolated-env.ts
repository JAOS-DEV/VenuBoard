import {
  TEST_API_ORIGIN,
  TEST_STACK_PORTS,
  TEST_STACK_READY_ENV,
} from "../../../src/core/test-stack/identity.ts";
import { assertIsolatedTestClients } from "../../../src/core/test-stack/env.ts";

export function requireIsolatedTestEnv(
  env: Record<string, string | undefined> = process.env,
): {
  apiUrl: string;
  publishableKey: string;
  secretKey: string;
} {
  if (env[TEST_STACK_READY_ENV] !== "1") {
    throw new Error(
      "Playwright must be started with `npm run test:e2e` so it uses isolated project venuboard-test. Direct Playwright or a port-3000 development server is not allowed.",
    );
  }

  const issues = assertIsolatedTestClients(env);
  if (issues.length > 0) {
    throw new Error(
      `Playwright clients are not pointing at the isolated test stack:\n${issues.map((issue) => `  - ${issue}`).join("\n")}`,
    );
  }

  const apiUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
  const secretKey = env.SUPABASE_SECRET_KEY?.trim() ?? "";
  if (
    !apiUrl.includes(`:${String(TEST_STACK_PORTS.api)}`) ||
    apiUrl !== TEST_API_ORIGIN
  ) {
    throw new Error(
      `Playwright NEXT_PUBLIC_SUPABASE_URL must be ${TEST_API_ORIGIN} (isolated test API).`,
    );
  }

  return { apiUrl, publishableKey, secretKey };
}
