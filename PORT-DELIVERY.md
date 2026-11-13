# Education Life Center USA — Cloudflare Port: Delivery Notes

**What this is:** the Education Life Center USA web app, ported from the Muse
spaces runtime to a stock Cloudflare stack — one **Worker** (API + routing),
**D1** (database), and **static assets** (the built client) — so the public
GitHub repo connects in Cloudflare and serves the full system at
**educationlifecenterusa.com**. Staging project root: this folder (it is the
repo-ready project; `PORT-DELIVERY.md` itself does not need to be deployed).

**The install problem is fixed at the root:** `package.json` contains only
normal npm packages — no `file:` dependencies anywhere (the old
`@hatch/space-sdk` local file dependency, which is what broke the Cloudflare
install, is gone). `package-lock.json` is included for reproducible installs.

---

## 1. What was built

| Piece | Where | Notes |
|---|---|---|
| Worker entry | `src/worker.ts` | `POST /api/<actionName>` dispatches to the action handlers; every other path serves the static client. Handler errors return `{"error": "<message>"}` with HTTP 400 — the same message contract the old client had. |
| Action handlers | `src/server/actions.ts` | The reference implementation's handlers, prices, messages and flags carried over unchanged in behavior. Only the runtime surface was swapped: the DB is drizzle-orm over D1, `invalidateQueries` is a no-op (the client invalidates its own caches), and the two agent/inference touchpoints are shimmed (see §4). All 32 actions the client calls are present. One deliberate post-port behavior change: five operations actions are now gated behind the staff admin code (see §4). |
| Schema (types) | `src/server/schema.ts` | Copied unchanged; the same drizzle schema drives D1. |
| Database migrations | `migrations/0001…0015` | The reference migrations, verbatim — including 0014 (emptied) and 0015 (the salted PBKDF2 staff-code verifier planted in `site_settings`). For use with `wrangler d1 migrations apply`, or see the console alternative below. |
| Console schema | `db/schema.sql` | All 15 migrations concatenated in order — paste once into the D1 console on the empty database. Validated on a fresh database (20 tables created, verifier row planted). |
| Job seed | `db/seed-jobs.sql` | The 15 researched Oklahoma City listings (verified open 2026-11-13), generated from the reference `seedResearchedJobs` data. Idempotent — re-running changes nothing (validated: applied twice, still 15 rows). The `seedResearchedJobs` action also still exists server-side. |
| Client | `src/client/` | The reference client, identical pages, copy, six languages, formation banner/badges. Three files adapted: `api.ts` (fetch client to `/api/*`, same typed contract), `main.tsx` (plain react-query `QueryClient`), `App.tsx` (one import line). One new file: `SafeAreaTopScrim.tsx`, a local cosmetic replacement for the runtime's safe-area strip component. |
| Config | `wrangler.toml` | Worker name `education-life-center-usa`; `[assets]` serves `./dist` with `run_worker_first = ["/api/*"]`; D1 binding `DB`; SPA fallback on. One placeholder: `database_id` (see §3, step 1). |

**Formation mode is the launch contract, enforced server-side** by the single
`FORMATION_MODE` flag in `src/server/actions.ts` (flip it to `false` on
opening day — when the LLC is filed and its bank account exists — and every
gated action runs exactly as built): the $99 case door and $199 withdrawal
sittings refuse and create nothing; every payment step
(`applyForMembership`, `confirmBankPayment`, `setupPaymentMethod`,
`payInvoice`) refuses; `joinWaitlist` is live and saving; `getPublicStats`
returns pricing only; the members-only jobs lock and the staff admin gate
work exactly as before. The pre-existing second flag `MEMBERSHIP_OPEN`
(public subscribe parked on the waitlist) is also carried over unchanged.

**Admin code:** no plaintext staff code exists anywhere in this project
(verified by search). As in the reference, the database holds only a salted
PBKDF2 verifier (600,000 iterations, WebCrypto in the Worker), planted by
migration 0015 and checked server-side. Nothing in the port prints or
changes it.

---

## 2. Local verification — actual results (2026-11-13)

Environment: Node 24 / npm 10, `wrangler dev` (miniflare) + local D1 with
all 15 migrations applied; client built with Vite.

- **Install:** `npm install` — clean, 164 packages, no errors. (One fix was
  needed during the port: `@cloudflare/workers-types` bumped to ^5 to match
  the current wrangler's peer requirement.)
- **Typecheck:** `npm run typecheck` — clean.
- **Client build:** `npm run build` — `dist/` produced (HTML + JS + CSS +
  the four site images).
- **Worker bundle:** `wrangler deploy --dry-run` — passes; bindings `DB`
  (D1) and `ASSETS` resolve.
- **(a) joinWaitlist** — saved and returned the confirmation:
  `{"alreadyOnList":false,"totalOnList":1,"entry":{…,"position":1,…}}`
- **(b) startCase529** — refused, HTTP 400, with the formation message
  ("This door is opening soon — the Center is in formation. Education Life
  Center USA, LLC has not been filed yet and its bank account is not open,
  so no cases or sittings are being taken and no fee is charged. Join the
  membership waitlist and we will invite you when the doors open.").
  Follow-up count: `cases_529` = **0 rows**.
- **(c) startWithdrawalSitting** — refused with the same formation message;
  `withdrawal_sittings` = **0 rows**.
- **(d) getPublicStats** — pricing only, no operational counts:
  `{"casePricing":{"foundingLimit":50,"foundingFee":99,"standardFee":149,"nextCaseFee":99,"isFoundingPrice":true},"withdrawalPricing":{"fee":199}}`
- **(e) listJobs** — seeded 15 listings via the `seedResearchedJobs` action
  (`{"ok":true,"inserted":15,"skipped":0}`). Bogus email/key → refused:
  "The Job Promotion board is for members only…". A test member inserted
  directly in local D1 (SHA-256 access-key hash, the server's own scheme):
  valid email + key → all 15 listings returned; valid email + WRONG key →
  refused ("Member access is not authorized…"). `getDashboard` and
  `verifyMemberCard` with that member also returned the correct,
  privacy-limited shapes (card check shows only found/valid/tier/status).
- **(f) adminOverview with a wrong code** — refused: "Admin access denied —
  that code is not correct. Operations stay locked." (The full PBKDF2
  verification path runs server-side; a wrong code derives and mismatches,
  as designed.)
- **Payment step spot-check** — `applyForMembership` refused with the
  formation payment message ("Payments are not active yet…").
- **Journeys + email reports** — `startJourney` issued `JOURNEY-0001`; a
  guided-door `reportDoorCompletion` recorded the completion with the $25
  navigation fee marked *due* (a record, not a collection — same as the
  reference); the 4 generated email reports sit in `email_reports` at
  status **`recorded`** (see §4).
- **Static serving** — `GET /` returns the built client; JS asset returns
  HTTP 200; unknown action returns a clean 404 JSON.

---

## 3. Owner steps in Cloudflare (the fewest taps — all in your own account)

Do these in order. Steps 1–2 prepare the database; step 3 connects the
repo; step 4 attaches the domain.

1. **Create the database.** Dashboard → **Storage & Databases → D1 → Create
   database** → name it exactly `education-life-center-usa` → **Create**.
   The page shows a **Database ID** — copy it and paste it over the
   placeholder on the `database_id` line in `wrangler.toml` (one edit; in
   the GitHub web editor is fine), then commit. *(Wrangler could create the
   database and fill this in automatically, but its commands need your
   Cloudflare login, so the dashboard is the honest route.)*
2. **Load the schema + jobs.** In the same D1 database → **Console** tab →
   paste the whole of `db/schema.sql` → **Run**. Then paste
   `db/seed-jobs.sql` → **Run**. (Two pastes total. The alternative —
   `npm run db:migrate:remote` and `db:seed` via wrangler — needs your
   login on a computer, so the console is fewer moving parts.)
3. **Connect the repo and deploy.** Dashboard → **Workers & Pages → Create
   → Import from Git** *(the flow you already started)* → choose
   **Seng2018/education-life-center-usa** → build command `npm run build`,
   deploy command `npx wrangler deploy` → **Deploy**. This time the
   install succeeds — there are no local file dependencies left to miss.
4. **Attach the domain.** Open the new Worker → **Settings → Domains &
   Routes → Add → Custom domain** → `educationlifecenterusa.com` → Add.
   Repeat for `www.educationlifecenterusa.com`. (The domain's DNS already
   lives in your Cloudflare account, so both attach with no further DNS
   work.)
5. **Optional — light up the assistant's AI answers.** Worker → **Settings
   → Bindings → Add → Workers AI**, name it exactly `AI`. Without it, the
   on-site assistant answers with a safe "a person can help — join the
   waitlist" reply (see §4). Everything else works without this step.

After step 4, the site is live at https://educationlifecenterusa.com **in
formation mode**: waitlist saving, doors opening-soon, no fees collected —
until opening day's single flag flip.

---

## 4. Remaining gaps and faithful-behavior notes

- **Email delivery (the one real gap).** In the reference system, journey
  and activation events generate two email reports (family summary +
  Center activity) that the Center's Gmail agent delivers, after which
  `confirmEmailReportsSent` marks them sent. This port has **no email
  provider**: reports are still generated and recorded in `email_reports`
  with status `recorded`, and the site shows them as **"on its way"** —
  never as sent. No report is lost; delivery wiring (e.g. an email service
  + a cron/queue consumer that calls `confirmEmailReportsSent`) is a
  follow-up build, deliberately not improvised here.
- **On-site AI assistant.** The reference answers from verified facts via
  the runtime's inference. The port calls **Workers AI** with the identical
  verified-facts prompt when the `AI` binding exists (§3 step 5); otherwise
  it returns a safe, factual needs-human reply that routes the visitor to
  the waitlist. It never invents prices or rules in either path.
- **Operations actions are admin-gated (hardening applied, 2026-11-13).**
  In the reference, the operations endpoints carried no admin-code check —
  they sat inside the space runtime's trust boundary. On Cloudflare they
  are public HTTP endpoints, so five of them now require the staff admin
  code in the request, verified server-side by the same salted PBKDF2
  check `adminOverview` and `confirmBankPayment` use: `updateCase529`,
  `updateWithdrawalSitting`, `updateApplication`, `updateDoorFee`, and
  `seedResearchedJobs` (a utility with no public caller; the D1 seed SQL
  remains the primary seeding route). A call with no code fails request
  validation; a wrong code is refused with the operations-locked message.
  Verified locally (miniflare + local D1) using a throwaway test code
  whose verifier was planted only in the local test database — the real
  staff code and its verifier were never used or printed: each gated
  action refused with no code, refused with a wrong code, and succeeded
  with the test code (seed run inserted the 15 listings); `joinWaitlist`
  still saves and `startCase529` still refuses in formation mode;
  typecheck clean and `wrangler deploy --dry-run` passes. This client
  never called those five actions — its Admin panel calls only
  `adminOverview` and `confirmBankPayment`, which already pass the code
  from the Admin sign-in state — so no client change was needed; callers
  with the staff code (operations tooling) pass it in the request.
  **`postJob` is deliberately left public**: its only caller in this
  client is the employer-facing `PostJobForm` in the Jobs section of
  `src/client/App.tsx` — a designed public intake whose success message
  tells the employer the opening is live on the board — so gating it with
  the staff code would break a founder-designed public flow. This
  hardening changes nothing in formation mode's money contract (the doors
  create nothing and no fee can be collected); it only stops strangers
  from advancing cases/sittings, marking fees paid, or seeding listings.
- **Response validation.** The old runtime also validated each handler's
  return against its response schema; the port returns handler results
  directly (the same view functions build the same shapes). Request
  validation is unchanged (the actions' own zod schemas).
- **`subscribe` parking order.** `subscribe` refuses with the waitlist
  message (governed by `MEMBERSHIP_OPEN`, as in the reference) rather than
  the formation payment message — the reference's exact behavior, kept.
- **Cosmetics.** `SafeAreaTopScrim` is a small local component standing in
  for the runtime's chrome strip; the Google Fonts import in `theme.css`
  is unchanged and loads from Google's CDN as before.
