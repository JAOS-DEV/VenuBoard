#!/usr/bin/env node

/**
 * Non-secret local-development status. Does not read .env.local or print keys.
 */
console.log(`VenuBoard local development

URLs
  Application:     http://localhost:3000
  Developer hub:   http://localhost:3000/en/dev
  English sign-in: http://localhost:3000/en/sign-in
  Thai sign-in:    http://localhost:3000/th/sign-in
  Studio:          http://127.0.0.1:54323
  Mailbox:         http://127.0.0.1:54324
  Auth health:     http://127.0.0.1:54321/auth/v1/health

Commands
  npm run local:start     Start local Supabase, then Next.js (no database reset)
  npm run local:reset     Reset and reseed the local Docker database only
  npm run supabase:stop   Stop the local Supabase containers

Fictional personas
  Open http://localhost:3000/en/dev
  There are no committed passwords. Use a magic link and the local inbox.

The developer hub is unavailable outside ordinary local development.
The Playwright test-identity cookie remains test-only.
`);
