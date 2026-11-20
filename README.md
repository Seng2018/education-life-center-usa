# Education Life Center USA — website & member system

The online system for **Education Life Center USA, LLC** (Oklahoma City), running on **Cloudflare Workers + D1** at **educationlifecenterusa.com**.

> **Status: FORMATION MODE.** The membership waitlist is live and saving names. The $99→$149 guided 529 case door and the $199 Guided Withdrawal sittings are presented as *opening soon / in formation* and take no cases; **no fees are collected and no payment step is active** until the LLC is filed and its bank account exists. One flag (`FORMATION_MODE` in `src/server/actions.ts`) lifts the mode on opening day.

## The live project (Cloudflare port, 2026-11-13)

- `src/worker.ts` — the Worker: `POST /api/<action>` runs the system's actions; every other path serves the built client.
- `src/server/` — the action handlers and schema (ported intact from the reference system: prices, formation gates, members-only jobs lock, staff admin gate with a salted PBKDF2 verifier — no plaintext code anywhere).
- `src/client/` — the website (React, six languages: English, Español, Tiếng Việt, 中文, ລາວ, हिन्दी).
- `migrations/` — D1 migrations 0001–0015. `db/schema.sql` is the same schema as one console-paste file; `db/seed-jobs.sql` seeds the 15 researched job listings.
- `wrangler.toml` — Worker, assets and D1 configuration (the `database_id` is filled in by the owner at setup).
- `PORT-DELIVERY.md` — what was built, the local verification results, and the owner's numbered Cloudflare setup steps.

Build: `npm install` → `npm run build`. Deploy: `npx wrangler deploy` (or connect this repo in Cloudflare → Workers & Pages → Import from Git, with those same commands).

## Also in this repo

- `DATA-PLAN.md` — the system's data and interpretation record (prices, rulings, language decisions).
- `client/`, `server/`, `drizzle/` — the retired Muse-space original of this same system, kept for reference. The Cloudflare port above is the live deployment; the original continues to run in the owner's Muse library until the domain cutover is verified.

## Ownership

© 2026 Education Life Center USA, LLC project — Founder: Saly (Lan Xang Digital). Domain: educationlifecenterusa.com (registered 13 Nov 2026, Cloudflare).
- Live site: https://educationlifecenterusa.com (formation mode)
Build connection restored 20 Nov 2026.
