# Education Life Center USA — website & member system

The online system for **Education Life Center USA, LLC** (Oklahoma City): the public website plus the member machinery behind it.

- Public site in six languages (English, Español, Tiếng Việt, 中文, ລາວ, हिन्दी): the $99→$149 guided 529 case door, Guided Withdrawal sittings ($199), membership tiers ($15 / $25 / $40), the interactive self-service doors with journey tracking and email reports, and a public "closing soon" preview of Job Promotion.
- Members-only area (server-enforced): the Job Promotion board, Member Card application, Family Credit Support application.
- Participant pipeline: online application → fee invoice with the member's own bank payment reference → bank payment confirmed in operations → membership activates automatically → electronic member card (QR) issued → partner-store verification (validity, tier, status only).
- Admin operations behind a staff code: all live numbers are private, never public.

## Structure

- `client/` — the website (React + TypeScript): `client/src` holds all pages, the six language dictionaries and the header/layout.
- `server/` — the system's actions (database, pipeline, journeys, admin, card verification): `server/src/actions.ts`.
- `drizzle/` — database migrations (the full schema history).
- `DATA-PLAN.md` — the system's data and interpretation record (prices, rulings, language decisions).
- `space.json`, `package.json`, `bun.lock` — runtime configuration and dependencies.

## Running it

The system currently runs on the Muse spaces runtime (its server uses `@hatch/space-sdk`, a local runtime dependency declared in `package.json`). This repository is the project's source of record under the owner's GitHub account. Serving the public pages from this repo through Cloudflare follows the same pattern as edu-secu.com; running the full member machinery (accounts, database, email reports) on Cloudflare requires porting the server layer to Cloudflare Workers + D1 — a separate step, not a plain upload.

## Ownership

© 2026 Education Life Center USA, LLC project — Founder: Saly (Lan Xang Digital). Domain: educationlifecenterusa.com (registered 13 Nov 2026, Cloudflare).
