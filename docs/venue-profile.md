# Venue public profile

Authorized venue users manage the public site identity from `/[locale]/admin/profile`. This is **core profile** data on the existing venue, translation, branding and publication model. It is not a parallel venue type.

Saved public fields on a published venue **go live immediately**. There is no private draft-edit workflow for these fields.

## Public versus private

Customers may see:

- Public operational name (`venues.name` plus `venue_translations.name`)
- Short tagline and longer about text
- Optional public email, telephone and website
- Public address, optional coordinates, optional directions text
- Weekly opening hours and date-specific exceptions
- Controlled theme and colours

They must not see, and the public RPC never returns:

- Business legal name, billing address, owner login email or user profiles
- Exception `internal_note`
- Platform quarantine reason, support-session records or other tenant internals

Public contact fields are never copied from a private owner account. The editor states that they will be visible to customers.

Thai copy is optional. English is required to **publish**. Missing Thai falls back to the venue default locale, then to any remaining translation, then to `venues.name`.

All public copy is bounded plain text. The site does not render HTML or Markdown and does not use `dangerouslySetInnerHTML`.

## Actions

Venue-site publication is **`manage_venue`**, not `publish_content`. `publish_content` remains feed, events and offers only.

| Concern | Action | Owner | Manager | Editor / staff / booking |
| --- | --- | --- | --- | --- |
| Name, translations, address, coordinates, contacts, hours, publish/unpublish | `manage_venue` | ✅ | ✅ | ⛔ |
| Allowlisted theme, colours, system font | `manage_branding` | ✅ | ✅ | ⛔ |
| Platform quarantine / `unpublished_by_platform` | `moderate_content` | platform only | | |

Conditional rules still apply: **C16** subscription writes (`trial`, `active`, `past_due`), **C17** `core_profile` is always entitled while the venue exists, **C19** platform tenant writes need a support session with write access. Deactivated users and unknown scopes are denied. SQL/RLS is authoritative.

Definers do not write slug, timezone, classification, classification lock or quarantine columns.

## Contact and location

Optional public contacts are `phone`, `email` and `website` only. Line/WhatsApp remain deferred with `social_links`.

Validation:

- Email syntax, bounded length
- Bounded telephone; public `tel:` links are generated, never stored as HTML
- Websites must be `http` or `https`, with no credentials, control characters or dangerous schemes
- The platform never fetches a user-entered URL server-side

Location:

- Public address fields on `venues`
- Latitude and longitude only as a pair, within bounds
- Optional localizable directions text
- “Get directions” is a user-initiated OpenStreetMap link from validated coordinates, or from the address when coordinates are absent
- No map iframe, no arbitrary embed HTML, no user-supplied `directions_url` (the profile save clears that column)

Seed coordinates are invented and must not be treated as a real customer venue.

## Opening hours

Recurring hours are venue-local wall-clock values, not UTC timestamps. Audit metadata uses `timestamptz`.

| Rule | Behaviour |
| --- | --- |
| Day numbering | ISO-8601: Monday = 1 … Sunday = 7 |
| Intervals | Start-inclusive, end-exclusive |
| Overnight | `closes_next_day`; Friday 18:00 → Saturday 02:00 is one Friday interval |
| 24-hour day | `00:00`–`00:00` with `closes_next_day` |
| Max intervals | 4 per weekday or exception date |
| Max exceptions | 90 |
| Overlap | Rejected, including overnight spill onto the next morning |
| Unknown | `venues.opening_hours_mode = 'unknown'` and no weekly rows |
| Closed weekday | Row in `venue_closed_weekdays` (distinct from unknown) |
| Exception | Replaces that **local calendar date** |
| Prior overnight vs exception | A closed or replacement exception on Saturday truncates Friday overnight at 00:00 Saturday |
| Weekly closed Saturday | Does **not** truncate Friday overnight |
| Timezone | Read-only in the profile editor; events and offers already depend on it |
| Timezone change | Existing intervals keep the same local wall-clock; they are not converted |
| DST | PostgreSQL `AT TIME ZONE` / `Intl` local wall-clock. A weekly `01:30` still stores as that clock time even if a DST spring-forward skips it on one date. |

The complete proposed week and exception list is validated before write. A rejected payload does not leave a partial schedule. Overlap is also enforced by an integrity trigger so direct table writes cannot store conflicting weekly intervals.

## Honest public display

The public site shows weekly hours, the current local-day plan, relevant exceptions and the venue timezone. Status copy is only:

- “Open according to listed hours”
- “Closed according to listed hours”
- “Hours not provided”

That is **not** a live operational check. Listed hours do not guarantee the venue is actually open, and they do not change staff presence, atmosphere, offers, events or enquiry eligibility.

Status is calculated in the venue timezone, independent of the visitor’s browser timezone. The client refreshes at the next listed boundary and when the tab becomes visible. It does not poll.

## Publication and preview

Tenant users may move `publication_state` between `draft` and `published` only. They cannot set or leave `unpublished_by_platform`. Quarantine blocks publish and is not cleared by these RPCs. Publication does not unlock classification, override subscription/public-access restrictions, grant modules, or claim legal or production readiness.

Readiness for publish: English operational name and an English tagline **or** description. Contacts, images and opening hours are optional.

When unpublished, every public venue route — including offers, updates and enquiry intake — uses the existing `venue_is_publicly_visible` gate.

Private preview uses the authenticated session (`list_public_venue_profile` sets `preview: true` for tenants and scoped platform readers). There is no anonymous `?preview=true` bypass and no public preview token. Preview responses are not shared-cached (`force-dynamic`) and do not serialize private tenant records such as exception notes.

## Branding

The appearance section exposes only the existing allowlisted theme, colours and system font, with the same contrast protection as the rest of the public site. Logo, avatar and background upload remain deferred and labelled as such. Arbitrary CSS, JavaScript, HTML, embeds and custom fonts are out of scope.

## Admin and public routes

- Admin: `/[locale]/admin/profile` (also from admin home and desktop/more navigation; not an extra mobile bottom tab)
- Public home: `/[locale]/v/{slug}`
- “View public site” opens the public home for that venue, labelled as a preview when unpublished

## Intentionally deferred

- Production logo/hero uploads and any new media pipeline
- Custom fonts beyond the accepted list
- Custom domains and slug renaming
- Business ownership/membership changes
- Classification unlocking
- Payments or billing
- Geocoding providers, browser geolocation, customer tracking, Maps API keys
- Holiday-calendar subscriptions
- Staff scheduling
- Automatic staff/atmosphere reset from hours (OQ-21)
- Booking availability or capacity enforcement from hours
- New social-network integrations (Line/WhatsApp contacts)

## Remaining policy notes

Legal copy, production content classification, and whether a future approval workflow should wrap live profile edits are unchanged open questions. This milestone does not add those workflows.
