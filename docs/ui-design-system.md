# VenuBoard UI design system

**Status:** Canonical for user-facing work · **Last updated:** 2026-09-03

VenuBoard’s interface is **shadcn/ui plus Tailwind CSS**. Do not replace that stack with Material UI, Bootstrap, Chakra, or another large framework.

shadcn components are **source-owned by this repository**. Copies live under `src/components/ui` and are edited here; they are not a runtime package we “install and forget”.

## Layers

1. **Primitives** — `src/components/ui`  
   Low-level controls (Button, Input, Dialog, Sheet, Tabs, Badge, …). Style them with design tokens. Do not put product copy, RPCs, or tenant policy in primitives.

2. **Patterns** — `src/components/patterns` and `src/components/shells`  
   Reusable VenuBoard composition: page chrome, empty/error/loading states, status badges, form sections, compact headers, admin navigation.

3. **Features** — `src/components/{staff-presence,events,atmosphere,feed,platform,auth,dev}` and route files.
   Domain UI. Consume primitives and patterns. Do not invent a third visual system with one-off colour classes.

Anti-patterns: giant “god” components with dozens of booleans; repeating arbitrary Tailwind strings that already exist as a pattern; putting `not_entitled` or other database strings in class names or visible copy.

## Tokens and themes

Semantic CSS variables are defined in `src/app/globals.css` for light (`:root`) and dark (`.dark`). TypeScript inventories live in `src/core/ui/tokens.ts`.

Use token names (`background`, `primary`, `status-present`, …), not raw hex, in feature UI.

Theme selection is **light / dark / system**, persisted in `localStorage` key `venuboard-theme` via `next-themes`. Anonymous users do not store theme in the database. `html` uses `suppressHydrationWarning` and `color-scheme` to avoid a wrong-theme flash.

### Tenant branding

Public venue pages may overlay `--venue-accent` and `--venue-primary`. Core text/background stay on product tokens unless the stored pair still meets 4.5:1 contrast (`src/core/ui/branding.ts`). Invalid hex falls back. Dark mode must not reuse a colour that only works on white. Admin and platform shells stay on the neutral product theme. No custom CSS or executable styling.

## Breakpoints and motion

- Design **mobile first from 320px**.
- Representative widths: 320, 375, 390, 430, 768, ~1280.
- Interactive targets are at least **44×44px** (`h-11` / `size-11`).
- Inputs are at least **16px** on small screens (`text-base md:text-sm`).
- No horizontal page overflow (`document.documentElement.scrollWidth <= window.innerWidth`).
- Admin filter rows wrap (`flex-wrap`) or use labelled native selects below `md`; they must not scroll sideways.
- Honour `prefers-reduced-motion` (global CSS plus carousel pause).
- Support safe-area insets on headers and bottom navigation.

## Navigation

| Surface | Mobile | Larger screens |
| --- | --- | --- |
| Public venue | Compact customer header (identity, theme, language, account). No admin/platform/dev destinations. | Same information architecture |
| Venue admin | Bottom nav (`md:hidden`): Home / Staff / Events / Updates / Atmosphere / More, including only authorised destinations. More opens a sheet. Sign-out is not in the tab bar. | Compact header surface list (`hidden md:block`). CSS visibility is not authorisation; `venueAdminNavAccess` / `can()` still decide which items exist. |
| Platform | Compact header + drawer | Header nav: overview, onboard (if allowed) |
| Auth | Compact header, centred card | Same |
| Developer hub | Local-only compact utility chrome | Tabs for accounts, services, commands |

Hiding a control with CSS is not authorisation. `can()` and RLS still apply.

## Status vocabulary

Map internal states to human copy (`src/core/ui/status.ts`). Examples:

| Internal | Customer/admin copy |
| --- | --- |
| `not_entitled` | Not included in this venue’s plan |
| `entitled_disabled` | Module disabled |
| `expired` | Trial expired |
| `restricted` / `suspended` | Temporarily unavailable |

Never show `not_entitled`, `approval_status`, or similar raw strings in UI.

## Forms

- Visible labels, descriptions, required markers, and error text.
- One primary action per context; stack actions on small screens.
- Destructive actions use the destructive variant and confirmation.
- Sticky action bars are allowed on long admin forms.

## Accessibility

Landmarks, heading order, labelled inputs, dialog/sheet focus trap and Escape, visible focus rings, keyboard operation, contrast, reduced motion, and names that do not rely on colour alone.

Automated checks use `@axe-core/playwright` (locked in `package.json`) against representative public, auth and platform pages with tags `wcag2a`, `wcag2aa`, `wcag21a`, and `wcag21aa`. The suite fails on serious or critical impacts. Automated scans are **not** complete accessibility proof.

## Public vs admin vs platform

- **Public:** customers. Venue identity, staff, events, atmosphere, feed. No slugs, fallback-route badges, or internal navigation.
- **Venue admin:** fast phone operation. Compact lists, presence toggles, progressive disclosure.
- **Platform:** larger datasets, still usable on a phone. No implication that platform roles have tenant authority.

## Adding a future module

1. Reuse primitives and patterns; do not fork spacing/colour.
2. Add EN and TH messages together.
3. Translate entitlement/workflow states; do not print database enums.
4. Fit the correct shell (public / venue admin / platform).
5. Check 320–430px, tablet, desktop; light and dark; 44px targets; no overflow.
6. Include loading, empty, error, disabled, and unauthorized states.
7. Feature report must include: test persona, exact route, happy-path steps, expected results, permission/negative checks, mobile/light/dark checks, reset and teardown.

## Local gallery

`/{locale}/dev/ui` is the visual reference. It uses the same `isOrdinaryLocalDevelopment` guard as the developer hub and returns 404 elsewhere.
