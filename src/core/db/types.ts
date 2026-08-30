/**
 * TEMPORARY placeholder database types.
 *
 * There is no schema yet, so there is nothing to generate from. This file
 * exists only so the client factories are typed rather than `any`, and it MUST
 * be replaced by generated types once the first migrations land:
 *
 *   npm run db:types
 *
 * Do not hand-write entity types here. The schema is the source of truth, and
 * hand-maintained duplicates drift silently — see docs/data-model.md.
 */
export interface Database {
  public: {
    Tables: Record<never, never>;
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}
