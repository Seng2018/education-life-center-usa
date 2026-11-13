// Actions for Education Life Center USA.
//
// The system runs the membership automatically: subscribing issues a member
// number, a digital member card, tier billing invoices, and a referral code
// in one step; financial-service applications are checked and routed to a
// partner institution automatically; referral rewards are granted by the
// system the moment the 10th referred member subscribes. Every automated
// step is written to the automation log so members can see what the system
// did for them.
//
// Honesty rails (Founder's settled model): the Center itself never lends —
// Family Credit Support applications are routed to partner banks and credit
// unions, which make the decision. Nothing is collected at subscribe time;
// the first invoice is marked due at launch.
//
// Starting service set (Founder, 2026-11-11): Membership & the Member Card
// (with 529 Access), Job Promotion, and Family Credit Support are live.
// Term Advance (Service 5) is PARKED — kept in the schema and partner
// routing, but applyService refuses new Term Advance applications until
// the Center switches it on.
//
// THE DOOR (Founder, 2026-11-11): BOTH, in sequence — the case door
// FIRST, membership later. A non-member parent can start a one-time 529
// case (startCase529): guided setup of one child's Oklahoma 529 account
// for a flat fee paid only on success. The fee is for guidance only —
// never a percentage of the account. Advisor-sold (OklahomaDream 529)
// cases carry no success fee: the Center gives general guidance only
// there, and any advisor fee belongs to the advisor. The Center never
// touches 529 money and gives no personal investment advice — unchanged.
//
// CASE PRICING (Founder, 2026-11-11): $99 is the founding price for the
// first 50 completed cases, then $149 standard. startCase529 prices each
// new case from the completed-case count at the moment it starts and
// stores that price on the case row (feeAmount), so a case keeps the
// price it started with even after the founding price ends.
//
// GUIDED WITHDRAWAL (Founder, 2026-11-12): the second completed service —
// the case door's mirror at the other end of the journey. A family books
// a guided withdrawal sitting (startWithdrawalSitting); the account
// owner requests the withdrawal themselves on the state plan's site
// while the Center guides the mechanics and paperwork. The fee is flat
// — $199 per completed sitting (Founder's fee ruling, 2026-11-12,
// superseding the earlier same-day $99 draft ruling) —
// priced at booking and stored on the sitting row (feeAmount), due only
// when the sitting completes successfully, never a percentage of the
// amount withdrawn. The Center never touches 529 money, never holds the
// owner's password, and gives general education only — not investment
// advice and not tax preparation.
//
// MEMBERSHIP WAITLIST (Founder, 2026-11-11): the subscribe form is parked
// as a waitlist until the membership opens. joinWaitlist saves name and
// contact only — no member number, card, invoice, or referral code — and
// the subscribe action refuses new activations while the membership is
// closed. Existing members keep full dashboard access.
//
// INTERACTIVE DOORS + JOURNEYS (Founder, 2026-11-12): every door is
// self-service on the OFFICIAL website (the Center never receives or
// stores an official-site credential); each family's journey is tracked
// under a JOURNEY-#### number (click-outs timestamped; completions are
// the family's own self-reports, labelled as such). A reported
// completion of a GUIDED-tier door makes the flat $25 self-service
// navigation success fee due (navigation service only — government
// applications are always free); pointer doors carry no fee, and
// navigation completions never consume founding guided-case spots.
// Every journey event generates a family summary email and a Center
// activity report (delivered via the Center's agent; see
// generateEmailReports). askAssistant answers from the Center's verified
// content only, via ctx.inference, in the visitor's language.

import { z } from "zod";
import type { DrizzleD1Database } from "drizzle-orm/d1";

// ---------------------------------------------------------------------------
// CLOUDFLARE PORT SHIM (port, 2026-11-13): the original file ran on the Muse
// spaces runtime (@hatch/space-sdk). This port replaces the SDK surface with
// local definitions so the SAME action handlers run inside a Cloudflare
// Worker backed by D1:
//   - ctx.db() returns a drizzle-orm D1 database over the same schema;
//   - ctx.invalidateQueries() is a no-op (the client invalidates its own
//     react-query caches, exactly as it did before);
//   - ctx.agent.spawnTask (email delivery via the Center's agent) is NOT
//     available in this port — callers wrap it in try/catch, so email
//     reports are recorded in email_reports and stay "recorded" (shown as
//     "on its way"), never marked sent. See PORT-DELIVERY.md;
//   - ctx.inference.complete is backed by Workers AI when the AI binding
//     is present, and by a safe needs-human fallback otherwise.
// Nothing below this block was changed in behavior: handlers, prices,
// messages, and the FORMATION_MODE gate are the reference implementation's.
// ---------------------------------------------------------------------------

export interface Ctx {
  db<S = typeof schema>(): DrizzleD1Database<typeof schema>;
  invalidateQueries(): void;
  // Visitor country of the current request (Cloudflare's request.cf,
  // populated by the Worker in src/worker.ts). Undefined when the
  // request carries no cf data (e.g. local dev) — trackVisit stores
  // "XX" in that case.
  clientCountry?: string;
  inference: {
    complete(
      prompt: string,
      opts: { system?: string; schema?: unknown; timeout_secs?: number },
    ): Promise<{ answer: string; needsHuman: boolean }>;
  };
  agent: {
    spawnTask(
      task: string,
      opts?: { expectsAction?: string; dedupeKey?: string },
    ): Promise<unknown>;
  };
}

function defineAction<Req extends z.ZodType, Res extends z.ZodType>(def: {
  description?: string;
  request: Req;
  response: Res;
  handler: (ctx: Ctx, args: z.output<Req>) => Promise<z.output<Res>>;
}): {
  request: Req;
  response: Res;
  handler: (ctx: Ctx, args: z.output<Req>) => Promise<z.output<Res>>;
} {
  return def;
}
import { asc, desc, eq } from "drizzle-orm";
import * as schema from "./schema";

// ---------------------------------------------------------------------------
// Shared domain constants — the product definition the Founder settled in the
// OKC adaptation plan (services 1, 5, 6, 7 only; membership tiers in
// USD/month — Starter $15, Family $25, Family Plus $40, KEPT as the
// membership prices by the Founder's ruling, 2026-11-12; the $1-a-day
// single family price put to him was not adopted).
// ---------------------------------------------------------------------------

export const TIERS = {
  starter: { label: "Starter", monthly: 15, blurb: "One adult member" },
  family: { label: "Family", monthly: 25, blurb: "Parents + children covered free" },
  family_plus: { label: "Family Plus", monthly: 40, blurb: "Family + priority partner routing" },
} as const;

type TierKey = keyof typeof TIERS;

const PARTNERS: Record<"term_advance" | "family_credit", string[]> = {
  term_advance: ["Partner Credit Union — Education Lending Desk", "Community Bank Partner — Family Services"],
  family_credit: ["Community Bank Partner — Family Services", "Partner Credit Union — Education Lending Desk"],
};

const REFERRALS_PER_FREE_YEAR = 10;

// 529 case pricing (Founder, 2026-11-11): $99 founding price for the
// first 50 completed cases, then $149 standard. A new case is priced
// from the number of cases already completed when it starts.
export const FOUNDING_CASE_LIMIT = 50;
export const FOUNDING_CASE_FEE = 99;
export const STANDARD_CASE_FEE = 149;

// ADMIN ACCESS (Founder, 2026-11-13; hardened 2026-11-13): the Center's
// live operations numbers are staff-only. At opening the Center has no
// activity yet and public zeros would damage credibility, so every
// operational count (journeys, cases, doors, fees, email reports, and
// all other totals) lives only behind the staff admin code, checked
// server-side by adminOverview and the bank-payment confirmation. The
// public page and the public stats action never receive them.
// The code itself is NEVER written in this source: only a salted
// PBKDF2 verifier for it is stored, in the site_settings table (key
// "admin_code_hash"), seeded by migration through the operator-only
// migration channel — there is deliberately no action that can set or
// change it, so no caller can claim or reset the staff credential.
// The source is published to a public repository: a code written here
// would be readable by anyone, and the verifier is a slow salted hash
// (600,000 iterations), so it cannot be brute-forced back into the
// code either.
// The operations update actions (updateCase529, updateWithdrawalSitting,
// updateApplication, updateDoorFee, seedResearchedJobs) are gated by the
// same check (hardening, 2026-11-13): on Cloudflare they are public HTTP
// endpoints, so they no longer sit inside a runtime trust boundary.
// postJob is deliberately NOT gated — its only caller in the client is
// the public employer PostJobForm, a designed public intake.

export type CasePricing = {
  foundingLimit: number;
  foundingFee: number;
  standardFee: number;
  completedCases: number;
  foundingRemaining: number;
  nextCaseFee: number;
  isFoundingPrice: boolean;
};

export function casePricingFor(completedCases: number): CasePricing {
  const foundingRemaining = Math.max(0, FOUNDING_CASE_LIMIT - completedCases);
  const isFoundingPrice = foundingRemaining > 0;
  return {
    foundingLimit: FOUNDING_CASE_LIMIT,
    foundingFee: FOUNDING_CASE_FEE,
    standardFee: STANDARD_CASE_FEE,
    completedCases,
    foundingRemaining,
    nextCaseFee: isFoundingPrice ? FOUNDING_CASE_FEE : STANDARD_CASE_FEE,
    isFoundingPrice,
  };
}

// Guided withdrawal pricing (Founder's fee ruling, 2026-11-12): ONE
// simple price — $199 flat per completed sitting. This is its own
// price, separate from the 529 case pricing ($99 founding for the
// first 50 completed cases, then $149 standard), which is unchanged.
// Stored on the sitting row at booking, so a sitting keeps the price
// it booked with. Never a percentage of the withdrawal.
export const WITHDRAWAL_FEE = 199;

export type WithdrawalPricing = {
  fee: number;
};

export const WITHDRAWAL_PRICING: WithdrawalPricing = {
  fee: WITHDRAWAL_FEE,
};

// ---------------------------------------------------------------------------
// INTERACTIVE DOORS + JOURNEYS (Founder, 2026-11-12)
//
// Every door the site presents is self-service: the family registers on
// the OFFICIAL website themselves. The Center never asks for, receives,
// or stores any official-site credential. Per door the journey tracks
// three states — not started, went to the official site (click-out
// timestamped), completed (SELF-REPORTED by the family; official sites
// do not report back to the Center).
//
// SELF-SERVICE SUCCESS FEE (Founder ruling, 2026-11-12): $25 flat per
// GUIDED-tier door a family completes entirely by self-service and
// reports — the fee buys the Center's navigation service (matched door
// list, step guidance, AI help, journey tracking, email reports, the
// completion record on file), never a government form, application, or
// benefit. Pointer-tier doors carry no fee. Self-service completions
// are navigation completions — they never consume a founding guided
// case spot.
// ---------------------------------------------------------------------------

export const SELF_SERVICE_FEE = 25;

export const DOORS = {
  ok529: { name: "Oklahoma 529 — open an account", tier: "guided" },
  withdrawal529: { name: "Oklahoma 529 — request a withdrawal", tier: "guided" },
  fafsa_pell: { name: "FAFSA — Federal Pell Grant & federal aid", tier: "guided" },
  ok_promise: { name: "Oklahoma's Promise", tier: "guided" },
  pctc: { name: "Parental Choice Tax Credit (OkTAP)", tier: "guided" },
  child_care: { name: "Child Care Subsidy — OKDHSLive", tier: "guided" },
  va_dea_fry: { name: "VA Education Benefits — Chapter 35 & Fry Scholarship", tier: "guided" },
  inspired_teach: { name: "Inspired to Teach (Oklahoma Future Teachers)", tier: "guided" },
  concurrent: { name: "Concurrent Enrollment Tuition Waiver", tier: "guided" },
  foster_waiver: { name: "Foster Care Tuition Waiver (Independent Living Act)", tier: "guided" },
  nat_guard: { name: "Oklahoma National Guard Educational Assistance (EAP)", tier: "guided" },
  cherokee: { name: "Cherokee Nation — College Resource Center (Gadugi Portal)", tier: "guided" },
  choctaw: { name: "Choctaw Nation — Higher Education Program", tier: "guided" },
  chickasaw: { name: "Chickasaw Nation — Student Support & Education", tier: "guided" },
  muscogee: { name: "Muscogee Nation — Higher Education (Camphouse Portal)", tier: "guided" },
  osage: { name: "Osage Nation — Higher Education Scholarship", tier: "guided" },
  fseog: { name: "Federal Supplemental Educational Opportunity Grant (FSEOG)", tier: "pointer" },
  work_study: { name: "Federal Work-Study", tier: "pointer" },
  otag: { name: "Oklahoma Tuition Aid Grant (OTAG)", tier: "pointer" },
  oteg: { name: "Oklahoma Tuition Equalization Grant (OTEG)", tier: "pointer" },
  aotc: { name: "American Opportunity Tax Credit (AOTC)", tier: "pointer" },
  llc: { name: "Lifetime Learning Credit (LLC)", tier: "pointer" },
  rising_scholars: { name: "Oklahoma Rising Scholars Award", tier: "pointer" },
  reach_higher: { name: "Reach Higher — Finish Line Scholarships for Adults", tier: "pointer" },
  careertech: { name: "CareerTech Financial Aid", tier: "pointer" },
  able: { name: "Oklahoma ABLE (OK STABLE) Account", tier: "pointer" },
} as const;

export type DoorId = keyof typeof DOORS;

const DOOR_IDS = Object.keys(DOORS) as DoorId[];

function journeyNumberFor(id: number): string {
  return `JOURNEY-${pad(id, 4)}`;
}

type JourneyRow = typeof schema.journeys.$inferSelect;
type DoorProgressRow = typeof schema.doorProgress.$inferSelect;

async function ensureJourney(
  ctx: Ctx,
  name: string,
  email: string,
): Promise<JourneyRow> {
  const db = ctx.db<typeof schema>();
  const key = email.trim().toLowerCase();
  const existing = await db
    .select()
    .from(schema.journeys)
    .where(eq(schema.journeys.email, key))
    .limit(1);
  if (existing[0]) {
    if (name && existing[0].name !== name) {
      await db
        .update(schema.journeys)
        .set({ name, updatedAt: new Date() })
        .where(eq(schema.journeys.id, existing[0].id));
      return { ...existing[0], name };
    }
    return existing[0];
  }
  const inserted = await db
    .insert(schema.journeys)
    .values({
      journeyNumber: `JOURNEY-TMP-${crypto.randomUUID()}`,
      name: name || "Family",
      email: key,
    })
    .returning({ id: schema.journeys.id });
  const id = inserted[0]?.id ?? 0;
  const journeyNumber = journeyNumberFor(id);
  await db
    .update(schema.journeys)
    .set({ journeyNumber })
    .where(eq(schema.journeys.id, id));
  const rows = await db
    .select()
    .from(schema.journeys)
    .where(eq(schema.journeys.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error("Your journey could not be started. Please try again.");
  await logEvent(
    ctx,
    null,
    "journey_started",
    `Journey ${journeyNumber} started for ${row.name} (${row.email}) — self-service doors, journey tracking and email reports are on.`,
  );
  return row;
}

function doorStatusLine(p: DoorProgressRow): string {
  const door = DOORS[p.doorId as DoorId];
  const name = door ? door.name : p.doorId;
  if (p.status === "completed") {
    return `${name}: completed — reported by you${p.completedDate ? ` (finished ${p.completedDate})` : ""}${
      p.feeStatus === "due"
        ? ` — $${p.feeAmount} navigation success fee due`
        : p.feeStatus === "paid"
          ? ` — $${p.feeAmount} navigation success fee paid`
          : ""
    }`;
  }
  if (p.status === "visited") {
    return `${name}: you went to the official site${p.visitedAt ? ` on ${p.visitedAt.toLocaleDateString("en-US")}` : ""} — not yet reported finished`;
  }
  return `${name}: not started`;
}

// Builds the family's current door-status summary (used in email reports
// and in the journey dashboard data the client renders).
async function journeyDoorLines(
  ctx: Ctx,
  journeyId: number,
): Promise<{ lines: string[]; progress: DoorProgressRow[] }> {
  const db = ctx.db<typeof schema>();
  const progress = await db
    .select()
    .from(schema.doorProgress)
    .where(eq(schema.doorProgress.journeyId, journeyId))
    .orderBy(asc(schema.doorProgress.id));
  const touched = progress.filter((p) => p.status !== "not_started");
  return {
    lines:
      touched.length > 0
        ? touched.map(doorStatusLine)
        : ["No doors started yet — your matched doors are waiting on the website."],
    progress,
  };
}

// Generates the two email reports for a journey event (family summary +
// Center activity report), stores them, and asks the Center's own agent
// to deliver them by email (Gmail) and confirm through
// confirmEmailReportsSent. Delivery is best-effort: if the sending task
// cannot start, the reports stay on record as "recorded" and still show
// in operations — the journey event itself never fails over email.
async function generateEmailReports(
  ctx: Ctx,
  journey: JourneyRow,
  event: string,
  eventLabel: string,
): Promise<void> {
  const db = ctx.db<typeof schema>();
  const { lines } = await journeyDoorLines(ctx, journey.id);
  const caseRows = await db
    .select({ caseNumber: schema.cases529.caseNumber, status: schema.cases529.status })
    .from(schema.cases529)
    .where(eq(schema.cases529.email, journey.email));
  const sittingRows = await db
    .select({ sittingNumber: schema.withdrawalSittings.sittingNumber, status: schema.withdrawalSittings.status })
    .from(schema.withdrawalSittings)
    .where(eq(schema.withdrawalSittings.email, journey.email));
  const numbers: string[] = [`Journey number: ${journey.journeyNumber}`];
  for (const c of caseRows) numbers.push(`529 case ${c.caseNumber}: ${c.status.replace("_", " ")}`);
  for (const s of sittingRows) numbers.push(`Guided withdrawal sitting ${s.sittingNumber}: ${s.status.replace("_", " ")}`);

  const familySubject = `Your Education Life Center journey update — ${journey.journeyNumber}`;
  const familyBody = [
    `Hello ${journey.name},`,
    "",
    `What changed: ${eventLabel}.`,
    "",
    "Your numbers:",
    ...numbers.map((n) => `- ${n}`),
    "",
    "Your doors:",
    ...lines.map((l) => `- ${l}`),
    "",
    "A completion you report is your own report: official websites do not report back to the Center, so your dashboard shows what you told us. Government applications are always free — the Center's $25 self-service success fee (guided doors only, due only when you report a door finished) pays for our navigation service: your matched door list, step guidance, AI help, journey tracking, these email reports, and your completion record on file.",
    "",
    "Education Life Center USA — Oklahoma City. We guide; we never touch your money, and we never ask for any official-site password.",
  ].join("\n");
  const centerSubject = `Center activity report — ${journey.journeyNumber}: ${eventLabel}`;
  const centerBody = [
    `Journey: ${journey.journeyNumber} — ${journey.name} (${journey.email})`,
    `Event: ${eventLabel} (${event})`,
    "",
    "Numbers on file:",
    ...numbers.map((n) => `- ${n}`),
    "",
    "Door statuses (completions are family self-reports):",
    ...lines.map((l) => `- ${l}`),
  ].join("\n");

  const inserted = await db
    .insert(schema.emailReports)
    .values([
      {
        journeyId: journey.id,
        kind: "family_summary",
        event,
        recipient: journey.email,
        subject: familySubject,
        body: familyBody,
      },
      {
        journeyId: journey.id,
        kind: "center_activity",
        event,
        recipient: "center",
        subject: centerSubject,
        body: centerBody,
      },
    ])
    .returning({ id: schema.emailReports.id });
  const ids = inserted.map((r) => r.id).filter((n) => n > 0);
  if (ids.length === 0) return;
  await logEvent(
    ctx,
    null,
    "email_report",
    `Email reports generated for journey ${journey.journeyNumber} — ${eventLabel}: family summary to ${journey.email} + Center activity report.`,
  );
  try {
    await ctx.agent.spawnTask(
      [
        "Send two emails for Education Life Center USA using the connected Gmail account, exactly as written below — do not change the wording, amounts, or numbers.",
        "",
        `EMAIL 1 — to the family at ${journey.email}`,
        `Subject: ${familySubject}`,
        "Body:",
        familyBody,
        "",
        "EMAIL 2 — to the Center: send it to the Gmail account owner's own inbox (the Center operator reads it there).",
        `Subject: ${centerSubject}`,
        "Body:",
        centerBody,
        "",
        `When both emails are sent, call the confirmEmailReportsSent action of this artifact with reportIds [${ids.join(", ")}]. If an email cannot be sent, do not call the action for it and do not retry more than once. Do not message the user in chat about these emails.`,
      ].join("\n"),
      {
        expectsAction: "confirmEmailReportsSent",
        dedupeKey: `elc-email-reports-${ids.join("-")}`,
      },
    );
  } catch {
    // Delivery is best-effort — the reports stay "recorded" on file.
  }
}

// The full journey view the dashboard renders: the journey itself, every
// door's progress, the family's own service numbers (529 cases and
// guided withdrawal sittings under the same email), and the email
// reports generated for them.
async function loadJourneyView(ctx: Ctx, journey: JourneyRow) {
  const db = ctx.db<typeof schema>();
  const { progress } = await journeyDoorLines(ctx, journey.id);
  const byDoor = new Map(progress.map((p) => [p.doorId, p]));
  const doors = DOOR_IDS.map((doorId) => {
    const p = byDoor.get(doorId);
    const meta = DOORS[doorId];
    return {
      doorId,
      name: meta.name,
      tier: meta.tier as "guided" | "pointer",
      status: (p?.status ?? "not_started") as "not_started" | "visited" | "completed",
      visitedAt: p?.visitedAt ? p.visitedAt.toISOString() : null,
      completedDate: p?.completedDate ?? "",
      completedAt: p?.completedAt ? p.completedAt.toISOString() : null,
      feeAmount: p?.feeAmount ?? 0,
      feeStatus: (p?.feeStatus ?? "none") as "none" | "due" | "paid",
    };
  });
  const caseRows = await db
    .select()
    .from(schema.cases529)
    .where(eq(schema.cases529.email, journey.email))
    .orderBy(asc(schema.cases529.id));
  const sittingRows = await db
    .select()
    .from(schema.withdrawalSittings)
    .where(eq(schema.withdrawalSittings.email, journey.email))
    .orderBy(asc(schema.withdrawalSittings.id));
  const reportRows = await db
    .select()
    .from(schema.emailReports)
    .where(eq(schema.emailReports.journeyId, journey.id))
    .orderBy(desc(schema.emailReports.id))
    .limit(10);
  return {
    journey: {
      journeyNumber: journey.journeyNumber,
      name: journey.name,
      email: journey.email,
      startedAt: journey.createdAt.toISOString(),
    },
    doors,
    cases: caseRows.map((c) => ({
      caseNumber: c.caseNumber,
      childName: c.childName,
      status: c.status,
      feeStatus: c.feeStatus,
      feeAmount: c.feeAmount,
    })),
    sittings: sittingRows.map((s) => ({
      sittingNumber: s.sittingNumber,
      childName: s.childName,
      status: s.status,
      feeStatus: s.feeStatus,
      feeAmount: s.feeAmount,
    })),
    reports: reportRows
      .filter((r) => r.kind === "family_summary")
      .map((r) => ({
        id: r.id,
        subject: r.subject,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      })),
  };
}

const journeyViewShape = z.object({
  journey: z.object({
    journeyNumber: z.string(),
    name: z.string(),
    email: z.string(),
    startedAt: z.string(),
  }),
  doors: z.array(
    z.object({
      doorId: z.string(),
      name: z.string(),
      tier: z.enum(["guided", "pointer"]),
      status: z.enum(["not_started", "visited", "completed"]),
      visitedAt: z.string().nullable(),
      completedDate: z.string(),
      completedAt: z.string().nullable(),
      feeAmount: z.number(),
      feeStatus: z.enum(["none", "due", "paid"]),
    }),
  ),
  cases: z.array(
    z.object({
      caseNumber: z.string(),
      childName: z.string(),
      status: z.string(),
      feeStatus: z.string(),
      feeAmount: z.number(),
    }),
  ),
  sittings: z.array(
    z.object({
      sittingNumber: z.string(),
      childName: z.string(),
      status: z.string(),
      feeStatus: z.string(),
      feeAmount: z.number(),
    }),
  ),
  reports: z.array(
    z.object({
      id: z.number(),
      subject: z.string(),
      status: z.string(),
      createdAt: z.string(),
    }),
  ),
});

const journeyResponse = z.object({
  found: z.boolean(),
  view: journeyViewShape.nullable(),
  selfServiceFee: z.number(),
});

// The membership is parked on a waitlist until the Center opens it
// (Founder, 2026-11-11). While this is false, subscribe refuses new
// activations and the public form is the joinWaitlist form. Flip to true
// when the membership opens — the full subscribe automation below is
// untouched and takes over again.
const MEMBERSHIP_OPEN: boolean = false;

// FORMATION MODE (Founder, 2026-11-13): the site publishes in formation
// mode until Education Life Center USA, LLC is filed and its bank
// account exists. While this is true:
//   - the membership waitlist is the live intake (joinWaitlist saves
//     names; it activates nothing, as before);
//   - the $99 case door and the $199 guided-withdrawal sittings are
//     shown as opening soon / in formation and take NO real cases —
//     startCase529 and startWithdrawalSitting refuse server-side;
//   - NO fees are collected and NO payment step is active — the
//     payment-taking actions (applyForMembership, confirmBankPayment,
//     setupPaymentMethod, payInvoice) refuse server-side.
// The members-only jobs lock and the staff admin gate are unchanged.
// Flip to false when the LLC is filed and the company bank account is
// open — every gated action below then runs exactly as built.
const FORMATION_MODE: boolean = true;

const FORMATION_DOOR_MESSAGE =
  "This door is opening soon — the Center is in formation. Education Life Center USA, LLC has not been filed yet and its bank account is not open, so no cases or sittings are being taken and no fee is charged. Join the membership waitlist and we will invite you when the doors open.";
const FORMATION_PAYMENT_MESSAGE =
  "Payments are not active yet — the Center is in formation. Education Life Center USA, LLC has not been filed yet and its bank account is not open, so no fee can be collected and no payment step is available. Nothing is charged until the company and its bank account exist.";

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

function memberNumberFor(id: number): string {
  return `ELC-2026-${pad(id, 4)}`;
}

function referralCodeFor(id: number, name: string): string {
  const letters = name.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 4) || "ELC";
  return `${letters}${pad(id, 4)}`;
}

function cardNumberFor(id: number): string {
  const base = 5312000000000000 + id * 7919;
  const digits = String(base).slice(0, 16);
  return `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8, 12)} ${digits.slice(12, 16)}`;
}


// Member access keys (security correction, 2026-11-12): every member is
// issued a random access key at subscribe. Only its SHA-256 hash is
// stored; the dashboard and every member-scoped action must present the
// key, and the server derives the member from the verified key — never
// from a bare email or numeric ID alone.
async function hashAccessKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(key),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function newAccessKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function requireMemberAccess(
  ctx: Ctx,
  memberId: number,
  accessKey: string,
): Promise<void> {
  const db = ctx.db<typeof schema>();
  const rows = await db
    .select({ accessKeyHash: schema.members.accessKeyHash })
    .from(schema.members)
    .where(eq(schema.members.id, memberId))
    .limit(1);
  const stored = rows[0]?.accessKeyHash;
  if (!stored || (await hashAccessKey(accessKey)) !== stored) {
    throw new Error("Member access is not authorized — sign in with your email and access key.");
  }
}

// Staff admin code check: verifies the presented code against the
// salted PBKDF2 verifier stored in site_settings (format
// "pbkdf2-sha256$<iterations>$<salt hex>$<derived hex>", 600,000
// iterations — a slow, salted verifier, so the stored value cannot be
// brute-forced back into the code even though migrations are public).
// No stored verifier means admin stays locked for everyone.
async function adminCodeMatches(ctx: Ctx, adminCode: string): Promise<boolean> {
  const db = ctx.db<typeof schema>();
  const rows = await db
    .select({ value: schema.siteSettings.value })
    .from(schema.siteSettings)
    .where(eq(schema.siteSettings.key, "admin_code_hash"))
    .limit(1);
  const stored = rows[0]?.value;
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2-sha256") return false;
  const iterations = Number(parts[1]);
  const saltHex = parts[2] ?? "";
  const expected = parts[3] ?? "";
  if (!Number.isFinite(iterations) || iterations <= 0 || !saltHex || !expected) return false;
  const salt = new Uint8Array(
    (saltHex.match(/.{2}/g) ?? []).map((h) => parseInt(h, 16)),
  );
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(adminCode),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    256,
  );
  const actual = Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return actual === expected;
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

async function logEvent(
  ctx: Ctx,
  memberId: number | null,
  kind: string,
  message: string,
): Promise<void> {
  const db = ctx.db<typeof schema>();
  await db.insert(schema.automationEvents).values({ memberId, kind, message });
}

// Counts a member's confirmed referrals and grants a free year each time a
// new block of 10 is completed. Runs automatically after every subscription
// that carries a referral code.
async function settleReferralReward(
  ctx: Ctx,
  referrer: typeof schema.members.$inferSelect,
): Promise<void> {
  const db = ctx.db<typeof schema>();
  const referrals = await db
    .select()
    .from(schema.members)
    .where(eq(schema.members.referredByCode, referrer.referralCode));
  const blocksEarned = Math.floor(referrals.length / REFERRALS_PER_FREE_YEAR);
  if (blocksEarned > referrer.freeYearsEarned) {
    const newYears = blocksEarned - referrer.freeYearsEarned;
    await db
      .update(schema.members)
      .set({ freeYearsEarned: blocksEarned })
      .where(eq(schema.members.id, referrer.id));
    for (let i = 0; i < newYears; i++) {
      await db.insert(schema.invoices).values({
        memberId: referrer.id,
        invoiceNumber: `INV-${pad(referrer.id, 4)}-RW${referrer.freeYearsEarned + i + 1}`,
        periodLabel: `Referral reward year ${referrer.freeYearsEarned + i + 1}`,
        amount: 0,
        status: "covered_by_referral_reward",
      });
    }
    await logEvent(
      ctx,
      referrer.id,
      "referral_reward",
      `Referral reward granted automatically: ${newYears} free year(s) — ${referrals.length} members subscribed with your code.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

const memberShape = z.object({
  id: z.number(),
  memberNumber: z.string(),
  fullName: z.string(),
  email: z.string(),
  phone: z.string(),
  city: z.string(),
  state: z.string(),
  tier: z.string(),
  tierLabel: z.string(),
  monthlyAmount: z.number(),
  status: z.string(),
  referralCode: z.string(),
  freeYearsEarned: z.number(),
  referralCount: z.number(),
  referralsToNextReward: z.number(),
  joinedAt: z.string(),
  card: z.object({
    cardNumber: z.string(),
    status: z.string(),
    issuedAt: z.string(),
  }),
  children: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      birthYear: z.number(),
      schoolLevel: z.string(),
    }),
  ),
});

const applicationShape = z.object({
  id: z.number(),
  service: z.string(),
  amount: z.number().nullable(),
  purpose: z.string(),
  detail: z.string(),
  partner: z.string(),
  status: z.string(),
  decision: z.string(),
  createdAt: z.string(),
});

const invoiceShape = z.object({
  id: z.number(),
  invoiceNumber: z.string(),
  // Unique bank payment reference (pipeline, Founder 2026-11-13): the
  // participant pays the fee into the Center's bank account quoting it.
  paymentReference: z.string(),
  periodLabel: z.string(),
  amount: z.number(),
  status: z.string(),
  createdAt: z.string(),
});

const eventShape = z.object({
  id: z.number(),
  kind: z.string(),
  message: z.string(),
  createdAt: z.string(),
});

const listingShape = z.object({
  id: z.number(),
  employerName: z.string(),
  title: z.string(),
  location: z.string(),
  payRange: z.string(),
  description: z.string(),
  applyUrl: z.string(),
  employmentType: z.string(),
  requirements: z.string(),
  deadline: z.string(),
  verifiedDate: z.string(),
  createdAt: z.string(),
  applicationCount: z.number(),
});

type MemberRow = typeof schema.members.$inferSelect;

async function loadMemberView(ctx: Ctx, member: MemberRow) {
  const db = ctx.db<typeof schema>();
  const cardRows = await db
    .select()
    .from(schema.memberCards)
    .where(eq(schema.memberCards.memberId, member.id))
    .limit(1);
  const card = cardRows[0];
  const childRows = await db
    .select()
    .from(schema.children)
    .where(eq(schema.children.memberId, member.id))
    .orderBy(asc(schema.children.id));
  const referrals = await db
    .select()
    .from(schema.members)
    .where(eq(schema.members.referredByCode, member.referralCode));
  const tierInfo = TIERS[member.tier as TierKey] ?? TIERS.starter;
  const inCurrentBlock = referrals.length % REFERRALS_PER_FREE_YEAR;
  return {
    id: member.id,
    memberNumber: member.memberNumber,
    fullName: member.fullName,
    email: member.email,
    phone: member.phone,
    city: member.city,
    state: member.state,
    tier: member.tier,
    tierLabel: tierInfo.label,
    monthlyAmount: tierInfo.monthly,
    status: member.status,
    referralCode: member.referralCode,
    freeYearsEarned: member.freeYearsEarned,
    referralCount: referrals.length,
    referralsToNextReward:
      inCurrentBlock === 0 && referrals.length > 0
        ? 0
        : REFERRALS_PER_FREE_YEAR - inCurrentBlock,
    joinedAt: member.createdAt.toISOString(),
    card: {
      // The full card number never leaves the server — the dashboard
      // shows the masked form only (security correction, 2026-11-12).
      cardNumber: card?.cardNumber
        ? `•••• •••• •••• ${card.cardNumber.replace(/\D/g, "").slice(-4)}`
        : "",
      // Electronic-card status (pipeline, Founder 2026-11-13): no card
      // exists until activation, so an applicant reads
      // "awaiting_payment"; the card is "active" only while the
      // membership itself is active and current, and "lapsed" whenever
      // the membership is not current. The QR on the card encodes the
      // member number, never the card number.
      status: !card
        ? "awaiting_payment"
        : member.status === "active" && card.status === "active"
          ? "active"
          : "lapsed",
      issuedAt: card ? card.issuedAt.toISOString() : member.createdAt.toISOString(),
    },
    children: childRows.map((c) => ({
      id: c.id,
      name: c.name,
      birthYear: c.birthYear,
      schoolLevel: c.schoolLevel,
    })),
  };
}

const plan529Shape = z.object({
  id: z.number(),
  childName: z.string(),
  planChoice: z.string(),
  goalAmount: z.number(),
  monthlyContribution: z.number(),
  currentSaved: z.number(),
  targetYear: z.number(),
  status: z.string(),
  remindersOn: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const casePricingShape = z.object({
  foundingLimit: z.number(),
  foundingFee: z.number(),
  standardFee: z.number(),
  completedCases: z.number(),
  foundingRemaining: z.number(),
  nextCaseFee: z.number(),
  isFoundingPrice: z.boolean(),
});

// Public pricing carries NO operational counts (Founder, 2026-11-13):
// the completed-case count and the founding-spots-remaining figure are
// live operations numbers and stay in the Admin area only. The public
// page gets prices and the founding/standard state, nothing else.
const publicCasePricingShape = z.object({
  foundingLimit: z.number(),
  foundingFee: z.number(),
  standardFee: z.number(),
  nextCaseFee: z.number(),
  isFoundingPrice: z.boolean(),
});

function publicPricing(p: CasePricing): z.infer<typeof publicCasePricingShape> {
  return {
    foundingLimit: p.foundingLimit,
    foundingFee: p.foundingFee,
    standardFee: p.standardFee,
    nextCaseFee: p.nextCaseFee,
    isFoundingPrice: p.isFoundingPrice,
  };
}

// A 529 case at the front door: one non-member parent, one child, one
// account opened. feeAmount is the flat guidance fee locked in when the
// case started ($99 founding for the first 50 completed cases, then $149
// standard); feeStatus says whether it can ever fall due (advisor-sold
// cases: not_due), whether it is waiting on success (due_on_success),
// or has been paid.
const case529Shape = z.object({
  id: z.number(),
  caseNumber: z.string(),
  parentName: z.string(),
  email: z.string(),
  phone: z.string(),
  city: z.string(),
  childName: z.string(),
  planChoice: z.string(),
  goalAmount: z.number(),
  monthlyContribution: z.number(),
  status: z.string(),
  feeStatus: z.string(),
  feeAmount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

type Case529Row = typeof schema.cases529.$inferSelect;

function case529View(c: Case529Row): z.infer<typeof case529Shape> {
  return {
    id: c.id,
    caseNumber: c.caseNumber,
    parentName: c.parentName,
    email: c.email,
    phone: c.phone,
    city: c.city,
    childName: c.childName,
    planChoice: c.planChoice,
    goalAmount: c.goalAmount,
    monthlyContribution: c.monthlyContribution,
    status: c.status,
    feeStatus: c.feeStatus,
    feeAmount: c.feeAmount,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

const startCase529Response = z.object({ case529: case529Shape });

const withdrawalPricingShape = z.object({
  fee: z.number(),
});

// A guided withdrawal sitting: one family, one child, one withdrawal
// guided end to end. feeAmount is the flat guidance fee locked in at
// booking — $199 flat; feeStatus says
// waiting on a completed sitting (due_on_success) or has been paid.
const withdrawalSittingShape = z.object({
  id: z.number(),
  sittingNumber: z.string(),
  parentName: z.string(),
  email: z.string(),
  phone: z.string(),
  city: z.string(),
  childName: z.string(),
  planChoice: z.string(),
  purpose: z.string(),
  isMember: z.boolean(),
  plannedAmount: z.number(),
  targetDate: z.string(),
  status: z.string(),
  feeStatus: z.string(),
  feeAmount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

type WithdrawalSittingRow = typeof schema.withdrawalSittings.$inferSelect;

function withdrawalSittingView(s: WithdrawalSittingRow): z.infer<typeof withdrawalSittingShape> {
  return {
    id: s.id,
    sittingNumber: s.sittingNumber,
    parentName: s.parentName,
    email: s.email,
    phone: s.phone,
    city: s.city,
    childName: s.childName,
    planChoice: s.planChoice,
    purpose: s.purpose,
    isMember: s.isMember === 1,
    plannedAmount: s.plannedAmount,
    targetDate: s.targetDate,
    status: s.status,
    feeStatus: s.feeStatus,
    feeAmount: s.feeAmount,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

const startWithdrawalResponse = z.object({ sitting: withdrawalSittingShape });

// One membership-waitlist entry: a name and contact saved for the opening,
// plus the person's place in line. Nothing is activated by joining.
const waitlistEntryShape = z.object({
  id: z.number(),
  fullName: z.string(),
  email: z.string(),
  phone: z.string(),
  city: z.string(),
  interestedTier: z.string().nullable(),
  note: z.string(),
  position: z.number(),
  joinedAt: z.string(),
});

const joinWaitlistResponse = z.object({
  alreadyOnList: z.boolean(),
  totalOnList: z.number(),
  entry: waitlistEntryShape,
});

const subscribeResponse = z.object({
  member: memberShape,
  invoice: invoiceShape,
  // The member's personal access key, shown once at subscribe (empty
  // when an existing account is returned — the key is never re-shown).
  accessKey: z.string(),
});

const dashboardResponse = z.object({
  member: memberShape,
  applications: z.array(applicationShape),
  invoices: z.array(invoiceShape),
  events: z.array(eventShape),
  paymentMethod: z
    .object({
      method: z.string(),
      provider: z.string(),
      last4: z.string(),
      autoRenew: z.boolean(),
    })
    .nullable(),
  payments: z.array(
    z.object({
      id: z.number(),
      invoiceNumber: z.string(),
      amount: z.number(),
      method: z.string(),
      provider: z.string(),
      receiptNumber: z.string(),
      status: z.string(),
      createdAt: z.string(),
    }),
  ),
  jobApplications: z.array(
    z.object({
      id: z.number(),
      listingId: z.number(),
      title: z.string(),
      employerName: z.string(),
      status: z.string(),
      createdAt: z.string(),
    }),
  ),
  plans529: z.array(plan529Shape),
});


// ---------------------------------------------------------------------------
// PARTICIPANT PIPELINE (Founder, 2026-11-13): form → fee invoice paid to
// the bank → electronic card issued automatically. One shared
// implementation: `subscribe` calls it when the membership opens, and
// `applyForMembership` calls it now for staff-assisted applications and
// end-to-end verification while the public subscribe stays parked on
// the waitlist. The application saves the member as "awaiting_payment"
// with a fee invoice carrying a unique bank payment reference; NO card
// is issued yet. Activation happens only in confirmBankPayment, when
// operations confirms the fee arrived at the Center's bank account.
// Honest limit: live fee collection needs the Center's bank account,
// which exists only after formation completes — until then the
// pipeline is exercised in the sandbox and with staff-assisted records.
// ---------------------------------------------------------------------------

type MembershipApplicationArgs = {
  fullName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  tier: "starter" | "family" | "family_plus";
  referralCode?: string | undefined;
  children: { name: string; birthYear: number; schoolLevel: string }[];
};

function paymentReferenceFor(memberId: number): string {
  return `PAY-${pad(memberId, 4)}-001`;
}

async function createMembershipApplication(
  ctx: Ctx,
  args: MembershipApplicationArgs,
): Promise<z.infer<typeof subscribeResponse>> {
  const db = ctx.db<typeof schema>();

  // One membership per email — return the existing account instead of a duplicate.
  const existing = await db
    .select()
    .from(schema.members)
    .where(eq(schema.members.email, args.email))
    .limit(1);
  if (existing[0]) {
    const member = await loadMemberView(ctx, existing[0]);
    const invRows = await db
      .select()
      .from(schema.invoices)
      .where(eq(schema.invoices.memberId, existing[0].id))
      .orderBy(asc(schema.invoices.id))
      .limit(1);
    const inv = invRows[0];
    return {
      accessKey: "",
      member,
      invoice: inv
        ? {
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            paymentReference: inv.paymentReference,
            periodLabel: inv.periodLabel,
            amount: inv.amount,
            status: inv.status,
            createdAt: inv.createdAt.toISOString(),
          }
        : {
            id: 0,
            invoiceNumber: "",
            paymentReference: "",
            periodLabel: "",
            amount: 0,
            status: "awaiting_bank_payment",
            createdAt: new Date().toISOString(),
          },
    };
  }

  // Validate the referral code, if one was entered.
  let referrer: MemberRow | undefined;
  if (args.referralCode && args.referralCode.trim() !== "") {
    const refRows = await db
      .select()
      .from(schema.members)
      .where(eq(schema.members.referralCode, args.referralCode.trim().toUpperCase()))
      .limit(1);
    referrer = refRows[0];
  }

  const inserted = await db
    .insert(schema.members)
    .values({
      memberNumber: "PENDING",
      fullName: args.fullName,
      email: args.email,
      phone: args.phone,
      city: args.city,
      state: args.state,
      tier: args.tier,
      status: "awaiting_payment",
      referralCode: "PENDING",
      referredByCode: referrer ? referrer.referralCode : null,
    })
    .returning({ id: schema.members.id });
  const newId = inserted[0]?.id;
  if (!newId) throw new Error("The application could not be saved. Please try again.");

  const memberNumber = memberNumberFor(newId);
  const referralCode = referralCodeFor(newId, args.fullName);
  await db
    .update(schema.members)
    .set({ memberNumber, referralCode })
    .where(eq(schema.members.id, newId));

  // The member's personal access key — shown once, in this response;
  // only its hash is stored. With it the applicant can already open
  // their dashboard and watch the application status.
  const accessKey = newAccessKey();
  await db
    .update(schema.members)
    .set({ accessKeyHash: await hashAccessKey(accessKey) })
    .where(eq(schema.members.id, newId));

  await logEvent(
    ctx,
    newId,
    "application_received",
    `Membership application saved for ${args.fullName} — member number ${memberNumber} is reserved and the membership is AWAITING PAYMENT. No member card is issued until the fee is confirmed at the bank.`,
  );

  // Children registered under the family membership (covered free).
  for (const child of args.children) {
    await db.insert(schema.children).values({
      memberId: newId,
      name: child.name,
      birthYear: child.birthYear,
      schoolLevel: child.schoolLevel,
    });
  }
  if (args.children.length > 0) {
    await logEvent(
      ctx,
      newId,
      "children_registered",
      `${args.children.length} child profile(s) added under the family membership — children are covered free.`,
    );
  }

  // The fee invoice, with the unique bank payment reference.
  const tierInfo = TIERS[args.tier];
  const now = new Date();
  const invoiceNumber = `INV-${pad(newId, 4)}-001`;
  const paymentReference = paymentReferenceFor(newId);
  const periodLabel = `First month — ${monthLabel(now)} (${tierInfo.label} plan)`;
  const invInserted = await db
    .insert(schema.invoices)
    .values({
      memberId: newId,
      invoiceNumber,
      paymentReference,
      periodLabel,
      amount: tierInfo.monthly,
      status: "awaiting_bank_payment",
    })
    .returning({ id: schema.invoices.id });
  await logEvent(
    ctx,
    newId,
    "invoice_created",
    `Fee invoice ${invoiceNumber} for $${tierInfo.monthly} issued. Pay it into the Center's bank account quoting payment reference ${paymentReference} — when operations confirms the payment, your membership activates automatically and your electronic member card is issued. (Live collection starts when the Center's bank account opens at formation.)`,
  );

  const memberRows = await db
    .select()
    .from(schema.members)
    .where(eq(schema.members.id, newId))
    .limit(1);
  const memberRow = memberRows[0];
  if (!memberRow) throw new Error("The application could not be saved. Please try again.");
  const member = await loadMemberView(ctx, memberRow);
  ctx.invalidateQueries();
  return {
    accessKey,
    member,
    invoice: {
      id: invInserted[0]?.id ?? 0,
      invoiceNumber,
      paymentReference,
      periodLabel,
      amount: tierInfo.monthly,
      status: "awaiting_bank_payment",
      createdAt: now.toISOString(),
    },
  };
}

const okResponse = z.object({ ok: z.literal(true) });

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export const ActionDefs = {
  getPublicStats: defineAction({
    description:
      "Returns PUBLIC pricing only — the current 529 case pricing (founding $99 for the first 50 completed cases, then $149 standard, with the fee the next case will carry) and the guided withdrawal pricing (one simple price: $199 flat per completed sitting). It returns NO operational counts: every live number the Center runs on (members, cases, sittings, journeys, doors, fees, reports, waitlist) is staff-only behind the admin code in adminOverview (Founder, 2026-11-13 — at opening the Center has no activity yet and public zeros would damage credibility).",
    request: z.object({}),
    response: z.object({
      casePricing: publicCasePricingShape,
      withdrawalPricing: withdrawalPricingShape,
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const caseRows = await db
        .select({ id: schema.cases529.id, status: schema.cases529.status })
        .from(schema.cases529);
      const completedCases = caseRows.filter((c) => c.status === "completed").length;
      return {
        casePricing: publicPricing(casePricingFor(completedCases)),
        withdrawalPricing: WITHDRAWAL_PRICING,
      };
    },
  }),

  trackVisit: defineAction({
    description:
      "Records ONE page visit for the site's own visitor counter: a row in `visits` holding only the path and the visitor's country, taken from Cloudflare's request.cf on the incoming request (\"XX\" when the request carries no country). Public and unauthenticated by design — it accepts nothing that could identify a visitor, and the client calls it once per browser session, fire-and-forget. Not gated by FORMATION_MODE: the counter runs while the Center is in formation, like the waitlist.",
    request: z.object({
      path: z.string().max(300).optional(),
    }),
    response: okResponse,
    handler: async (ctx, args) => {
      const db = ctx.db<typeof schema>();
      await db.insert(schema.visits).values({
        path: args.path ?? null,
        country: ctx.clientCountry ?? "XX",
      });
      return { ok: true as const };
    },
  }),

  getVisitorStats: defineAction({
    description:
      "Returns the visitor counter's public totals for the footer visitors line: the total number of tracked visits and the top 10 countries by visit count. Counts and country codes only — no paths, no timestamps, nothing that identifies a visitor. Public and unauthenticated, like getPublicStats.",
    request: z.object({}),
    response: z.object({
      total: z.number(),
      countries: z.array(
        z.object({ country: z.string(), count: z.number() }),
      ),
    }),
    handler: async (ctx) => {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select({ country: schema.visits.country })
        .from(schema.visits);
      const byCountry = new Map<string, number>();
      for (const row of rows) {
        const country = row.country ?? "XX";
        byCountry.set(country, (byCountry.get(country) ?? 0) + 1);
      }
      const countries = [...byCountry.entries()]
        .map(([country, count]) => ({ country, count }))
        .sort(
          (a, b) => b.count - a.count || a.country.localeCompare(b.country),
        )
        .slice(0, 10);
      return { total: rows.length, countries };
    },
  }),

  startCase529: defineAction({
    description:
      "Starts a one-time 529 case for a parent who is NOT a member: saves the case request with a confirmation and a case number. The flat guidance fee is priced at start from the completed-case count — $99 founding price while fewer than 50 cases have completed, then $149 standard — and that price is stored on the case. The fee falls due only when the case completes successfully (account opened and first contribution arranged); unfinished cases pay nothing, and advisor-sold OklahomaDream 529 cases carry no success fee. The Center never touches 529 money. FORMATION MODE (Founder, 2026-11-13): while FORMATION_MODE is true the case door is shown as opening soon / in formation and this action refuses — no real cases are taken until Education Life Center USA, LLC is filed and its bank account exists.",
    request: z.object({
      parentName: z.string().min(2).max(120),
      email: z.string().email().max(160),
      phone: z.string().max(30).default(""),
      city: z.string().min(1).max(80).default("Oklahoma City"),
      childName: z.string().min(1).max(80),
      planChoice: z.enum(["oklahoma_529", "oklahomadream_529", "undecided"]),
      goalAmount: z.number().min(0).max(1000000).default(0),
      monthlyContribution: z.number().min(0).max(100000).default(0),
    }),
    response: startCase529Response,
    handler: async (ctx, args): Promise<z.infer<typeof startCase529Response>> => {
      // FORMATION MODE: the case door takes no real cases yet.
      if (FORMATION_MODE) throw new Error(FORMATION_DOOR_MESSAGE);
      const db = ctx.db<typeof schema>();
      // Advisor-sold cases: general guidance only, no success fee — the
      // advisor's own fee belongs to the advisor, not to this case.
      const feeStatus = args.planChoice === "oklahomadream_529" ? "not_due" : "due_on_success";
      // Price this case from the completed-case count right now
      // (Founder, 2026-11-11): $99 founding while fewer than 50 cases
      // have completed, then $149 standard. The price is stored on the
      // case, so it keeps this price even if the founding price ends
      // while the case is still open.
      const existingCases = await db
        .select({ status: schema.cases529.status })
        .from(schema.cases529);
      const completedCount = existingCases.filter((c) => c.status === "completed").length;
      const pricing = casePricingFor(completedCount);
      const feeAmount = pricing.nextCaseFee;
      const inserted = await db
        .insert(schema.cases529)
        .values({
          // Temporary unique number, replaced by CASE529-#### once the row
          // id exists — a shared placeholder would collide under the
          // unique constraint when two cases start at the same moment.
          caseNumber: `CASE529-TMP-${crypto.randomUUID()}`,
          parentName: args.parentName,
          email: args.email,
          phone: args.phone,
          city: args.city,
          childName: args.childName,
          planChoice: args.planChoice,
          goalAmount: args.goalAmount,
          monthlyContribution: args.monthlyContribution,
          status: "requested",
          feeStatus,
          feeAmount,
        })
        .returning({ id: schema.cases529.id });
      const id = inserted[0]?.id ?? 0;
      const caseNumber = `CASE529-${pad(id, 4)}`;
      await db
        .update(schema.cases529)
        .set({ caseNumber })
        .where(eq(schema.cases529.id, id));
      const planLabel =
        args.planChoice === "oklahoma_529"
          ? "Oklahoma 529 (direct)"
          : args.planChoice === "oklahomadream_529"
            ? "OklahomaDream 529 (advisor-sold)"
            : "plan still to choose — guidance requested";
      await logEvent(
        ctx,
        null,
        "case529_opened",
        `529 case ${caseNumber} opened at the case door: ${args.parentName} for ${args.childName} — ${planLabel}. ${
          feeStatus === "not_due"
            ? "Advisor-sold case: no success fee — general guidance only."
            : `Flat $${feeAmount} guidance fee (${pricing.isFoundingPrice ? `founding price — ${pricing.foundingRemaining} of the first ${pricing.foundingLimit} founding cases remaining when this case started` : "standard price — the founding price for the first 50 completed cases has ended"}) due only on success; nothing charged today.`
        }`,
      );
      const rows = await db
        .select()
        .from(schema.cases529)
        .where(eq(schema.cases529.id, id))
        .limit(1);
      const row = rows[0];
      if (!row) throw new Error("The case could not be saved. Please try again.");
      ctx.invalidateQueries();
      return { case529: case529View(row) };
    },
  }),

  updateCase529: defineAction({
    description:
      "Advances a 529 case in Center operations: marks it in progress, completed (success — the case's stored guidance fee falls due, $99 founding or $149 standard depending on when the case started, except advisor-sold cases which carry no fee), or records that fee as paid. Staff only: the caller must present the admin code, checked server-side (hardening, 2026-11-13).",
    request: z.object({
      adminCode: z.string().min(1).max(100),
      caseId: z.number().int().positive(),
      status: z.enum(["requested", "in_progress", "completed"]).optional(),
      feeStatus: z.enum(["not_due", "due_on_success", "paid"]).optional(),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      if (!(await adminCodeMatches(ctx, args.adminCode))) {
        throw new Error("Admin access denied — that code is not correct. Operations stay locked.");
      }
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.cases529)
        .where(eq(schema.cases529.id, args.caseId))
        .limit(1);
      const current = rows[0];
      if (!current) throw new Error("Case not found.");
      const nextStatus = args.status ?? current.status;
      let nextFeeStatus = args.feeStatus ?? current.feeStatus;
      // Completing a case makes the fee fall due — unless it is already
      // paid, or the case is advisor-sold and never carries a fee.
      if (nextStatus === "completed" && nextFeeStatus !== "paid") {
        nextFeeStatus = current.planChoice === "oklahomadream_529" ? "not_due" : "due_on_success";
      }
      await db
        .update(schema.cases529)
        .set({ status: nextStatus, feeStatus: nextFeeStatus, updatedAt: new Date() })
        .where(eq(schema.cases529.id, args.caseId));
      const feeNote =
        nextFeeStatus === "paid"
          ? ` — $${current.feeAmount} guidance fee paid.`
          : nextStatus === "completed" && nextFeeStatus === "due_on_success"
            ? ` — case succeeded: the $${current.feeAmount} guidance fee is now due.`
            : nextStatus === "completed" && nextFeeStatus === "not_due"
              ? " — advisor-sold case completed: no success fee (general guidance only)."
              : "";
      await logEvent(
        ctx,
        null,
        "case529_update",
        `529 case ${current.caseNumber} (${current.childName}, parent ${current.parentName}) is now “${nextStatus.replace("_", " ")}”${feeNote}`,
      );
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  startWithdrawalSitting: defineAction({
    description:
      "Books a guided withdrawal sitting: a family that needs to take money out of a child's Oklahoma 529 sits with the Center while the account owner requests the withdrawal themselves on the state plan's site — expense checked, destination chosen, same-calendar-year rule kept, 1099-Q paperwork explained. The flat guidance fee is one simple price — $199 per sitting — stored on the sitting at booking, and falls due only when the sitting completes successfully (withdrawal correctly requested and on its way); an unfinished sitting pays nothing. The fee is never a percentage of the withdrawal. The Center never touches 529 money, never holds the owner's password, and gives general education only — not investment advice and not tax preparation. FORMATION MODE (Founder, 2026-11-13): while FORMATION_MODE is true the sittings are shown as opening soon / in formation and this action refuses — no real sittings are booked until Education Life Center USA, LLC is filed and its bank account exists.",
    request: z.object({
      parentName: z.string().min(2).max(120),
      email: z.string().email().max(160),
      phone: z.string().max(30).default(""),
      city: z.string().min(1).max(80).default("Oklahoma City"),
      childName: z.string().min(1).max(80),
      planChoice: z.enum(["oklahoma_529", "oklahomadream_529", "undecided"]),
      purpose: z.enum(["college", "k12_tuition", "student_loan", "apprenticeship", "roth_rollover", "other_qualified"]),
      isMember: z.boolean().default(false),
      plannedAmount: z.number().min(0).max(1000000).default(0),
      targetDate: z.string().max(40).default(""),
    }),
    response: startWithdrawalResponse,
    handler: async (ctx, args): Promise<z.infer<typeof startWithdrawalResponse>> => {
      // FORMATION MODE: guided withdrawal sittings take no real bookings yet.
      if (FORMATION_MODE) throw new Error(FORMATION_DOOR_MESSAGE);
      const db = ctx.db<typeof schema>();
      // Price this sitting at booking (Founder's fee ruling,
      // 2026-11-12): one simple price — $199 flat. The price is
      // stored on the sitting, so it keeps this price whatever
      // happens later.
      const feeAmount = WITHDRAWAL_FEE;
      const inserted = await db
        .insert(schema.withdrawalSittings)
        .values({
          sittingNumber: `WDRAW-TMP-${crypto.randomUUID()}`,
          parentName: args.parentName,
          email: args.email,
          phone: args.phone,
          city: args.city,
          childName: args.childName,
          planChoice: args.planChoice,
          purpose: args.purpose,
          isMember: args.isMember ? 1 : 0,
          plannedAmount: args.plannedAmount,
          targetDate: args.targetDate,
          status: "requested",
          feeStatus: "due_on_success",
          feeAmount,
        })
        .returning({ id: schema.withdrawalSittings.id });
      const id = inserted[0]?.id ?? 0;
      const sittingNumber = `WDRAW-${pad(id, 4)}`;
      await db
        .update(schema.withdrawalSittings)
        .set({ sittingNumber })
        .where(eq(schema.withdrawalSittings.id, id));
      await logEvent(
        ctx,
        null,
        "withdrawal_sitting_booked",
        `Guided withdrawal sitting ${sittingNumber} booked: ${args.parentName} for ${args.childName} — purpose “${args.purpose.replace(/_/g, " ")}”. Flat $${feeAmount} guidance fee — one simple price — due only when the sitting completes; nothing charged today. The owner requests the withdrawal themselves — the Center guides and never touches 529 money.`,
      );
      const rows = await db
        .select()
        .from(schema.withdrawalSittings)
        .where(eq(schema.withdrawalSittings.id, id))
        .limit(1);
      const row = rows[0];
      if (!row) throw new Error("The sitting could not be saved. Please try again.");
      ctx.invalidateQueries();
      return { sitting: withdrawalSittingView(row) };
    },
  }),

  updateWithdrawalSitting: defineAction({
    description:
      "Advances a guided withdrawal sitting in Center operations: marks it in progress, completed (success — the withdrawal was correctly requested by the owner and is on its way, so the sitting's stored flat guidance fee falls due: $199 for sittings booked at the current price), or records that fee as paid. Staff only: the caller must present the admin code, checked server-side (hardening, 2026-11-13).",
    request: z.object({
      adminCode: z.string().min(1).max(100),
      sittingId: z.number().int().positive(),
      status: z.enum(["requested", "in_progress", "completed"]).optional(),
      feeStatus: z.enum(["not_due", "due_on_success", "paid"]).optional(),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      if (!(await adminCodeMatches(ctx, args.adminCode))) {
        throw new Error("Admin access denied — that code is not correct. Operations stay locked.");
      }
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.withdrawalSittings)
        .where(eq(schema.withdrawalSittings.id, args.sittingId))
        .limit(1);
      const current = rows[0];
      if (!current) throw new Error("Sitting not found.");
      const nextStatus = args.status ?? current.status;
      let nextFeeStatus = args.feeStatus ?? current.feeStatus;
      // Completing a sitting makes the fee fall due — unless it is
      // already paid.
      if (nextStatus === "completed" && nextFeeStatus !== "paid") {
        nextFeeStatus = "due_on_success";
      }
      await db
        .update(schema.withdrawalSittings)
        .set({ status: nextStatus, feeStatus: nextFeeStatus, updatedAt: new Date() })
        .where(eq(schema.withdrawalSittings.id, args.sittingId));
      const feeNote =
        nextFeeStatus === "paid"
          ? ` — $${current.feeAmount} guidance fee paid.`
          : nextStatus === "completed" && nextFeeStatus === "due_on_success"
            ? ` — sitting completed: the withdrawal is on its way and the $${current.feeAmount} guidance fee is now due.`
            : "";
      await logEvent(
        ctx,
        null,
        "withdrawal_sitting_update",
        `Guided withdrawal sitting ${current.sittingNumber} (${current.childName}, parent ${current.parentName}) is now “${nextStatus.replace("_", " ")}”${feeNote}`,
      );
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  startJourney: defineAction({
    description:
      "Starts (or resumes) a family's interactive journey under their email: issues a journey number (JOURNEY-####) and returns the full journey view — every door's progress, their 529 case and guided withdrawal sitting numbers under the same email, and their email reports. Starting a journey generates the first family summary email and Center activity report.",
    request: z.object({
      name: z.string().min(2).max(120),
      email: z.string().email().max(160),
    }),
    response: journeyResponse,
    handler: async (ctx, args): Promise<z.infer<typeof journeyResponse>> => {
      const db = ctx.db<typeof schema>();
      const key = args.email.trim().toLowerCase();
      const existed = await db
        .select({ id: schema.journeys.id })
        .from(schema.journeys)
        .where(eq(schema.journeys.email, key))
        .limit(1);
      const journey = await ensureJourney(ctx, args.name, args.email);
      if (!existed[0]) {
        await generateEmailReports(
          ctx,
          journey,
          "journey_started",
          "you started your journey — your doors, tracking, and reports are on",
        );
      }
      ctx.invalidateQueries();
      return {
        found: true,
        view: await loadJourneyView(ctx, journey),
        selfServiceFee: SELF_SERVICE_FEE,
      };
    },
  }),

  getJourney: defineAction({
    description:
      "Returns a family's journey view by the email they used — journey number, every door's progress (completions are the family's own self-reports), their 529 case and withdrawal sitting numbers, and their email reports. Returns found=false when no journey exists for that email yet.",
    request: z.object({ email: z.string().email().max(160) }),
    response: journeyResponse,
    handler: async (ctx, args): Promise<z.infer<typeof journeyResponse>> => {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.journeys)
        .where(eq(schema.journeys.email, args.email.trim().toLowerCase()))
        .limit(1);
      const journey = rows[0];
      if (!journey) return { found: false, view: null, selfServiceFee: SELF_SERVICE_FEE };
      return {
        found: true,
        view: await loadJourneyView(ctx, journey),
        selfServiceFee: SELF_SERVICE_FEE,
      };
    },
  }),

  recordDoorVisit: defineAction({
    description:
      "Records that a family clicked out from a door to the official website: the door moves to 'visited' with a timestamp (a completed door stays completed). Generates the family summary email and Center activity report for the click-out.",
    request: z.object({
      email: z.string().email().max(160),
      name: z.string().max(120).default(""),
      doorId: z.enum(Object.keys(DOORS) as [DoorId, ...DoorId[]]),
    }),
    response: journeyResponse,
    handler: async (ctx, args): Promise<z.infer<typeof journeyResponse>> => {
      const db = ctx.db<typeof schema>();
      const journey = await ensureJourney(ctx, args.name, args.email);
      const meta = DOORS[args.doorId];
      const existing = await db
        .select()
        .from(schema.doorProgress)
        .where(eq(schema.doorProgress.journeyId, journey.id))
        .limit(100);
      const current = existing.find((p) => p.doorId === args.doorId);
      if (!current) {
        await db.insert(schema.doorProgress).values({
          journeyId: journey.id,
          doorId: args.doorId,
          tier: meta.tier,
          status: "visited",
          visitedAt: new Date(),
        });
      } else if (current.status === "not_started") {
        await db
          .update(schema.doorProgress)
          .set({ status: "visited", visitedAt: new Date(), updatedAt: new Date() })
          .where(eq(schema.doorProgress.id, current.id));
      }
      await logEvent(
        ctx,
        null,
        "door_visit",
        `Journey ${journey.journeyNumber}: ${journey.name} went to the official site for “${meta.name}” (click-out recorded ${new Date().toLocaleString("en-US")}).`,
      );
      await generateEmailReports(
        ctx,
        journey,
        "door_visited",
        `you went to the official website for ${meta.name}`,
      );
      ctx.invalidateQueries();
      return {
        found: true,
        view: await loadJourneyView(ctx, journey),
        selfServiceFee: SELF_SERVICE_FEE,
      };
    },
  }),

  reportDoorCompletion: defineAction({
    description:
      "Records a family's SELF-REPORTED completion of a door (the family taps 'I finished' after registering on the official site themselves; official sites do not report back). For a guided-tier door this makes the flat $25 self-service navigation success fee due — it buys the Center's navigation service, never a government form or benefit. Pointer-tier doors carry no fee. Generates the family summary email and Center activity report.",
    request: z.object({
      email: z.string().email().max(160),
      name: z.string().max(120).default(""),
      doorId: z.enum(Object.keys(DOORS) as [DoorId, ...DoorId[]]),
      completedDate: z.string().max(40).default(""),
    }),
    response: journeyResponse,
    handler: async (ctx, args): Promise<z.infer<typeof journeyResponse>> => {
      const db = ctx.db<typeof schema>();
      const journey = await ensureJourney(ctx, args.name, args.email);
      const meta = DOORS[args.doorId];
      const isGuided = meta.tier === "guided";
      const rows = await db
        .select()
        .from(schema.doorProgress)
        .where(eq(schema.doorProgress.journeyId, journey.id))
        .limit(100);
      const current = rows.find((p) => p.doorId === args.doorId);
      if (!current) {
        await db.insert(schema.doorProgress).values({
          journeyId: journey.id,
          doorId: args.doorId,
          tier: meta.tier,
          status: "completed",
          visitedAt: new Date(),
          completedAt: new Date(),
          completedDate: args.completedDate,
          feeAmount: isGuided ? SELF_SERVICE_FEE : 0,
          feeStatus: isGuided ? "due" : "none",
        });
      } else if (current.status !== "completed") {
        await db
          .update(schema.doorProgress)
          .set({
            status: "completed",
            completedAt: new Date(),
            completedDate: args.completedDate || current.completedDate,
            feeAmount: isGuided ? SELF_SERVICE_FEE : 0,
            feeStatus: isGuided ? "due" : "none",
            updatedAt: new Date(),
          })
          .where(eq(schema.doorProgress.id, current.id));
      } else if (args.completedDate && args.completedDate !== current.completedDate) {
        await db
          .update(schema.doorProgress)
          .set({ completedDate: args.completedDate, updatedAt: new Date() })
          .where(eq(schema.doorProgress.id, current.id));
      }
      await logEvent(
        ctx,
        null,
        "door_completed",
        `Journey ${journey.journeyNumber}: ${journey.name} reported completing “${meta.name}” by self-service (self-reported${args.completedDate ? `, finished ${args.completedDate}` : ""})${isGuided ? ` — $${SELF_SERVICE_FEE} navigation success fee due (navigation service only; the government application itself is free)` : " — pointer door, no fee"}.`,
      );
      await generateEmailReports(
        ctx,
        journey,
        "door_completed",
        `you reported finishing ${meta.name} on the official website${
          isGuided
            ? ` — the $${SELF_SERVICE_FEE} self-service success fee for our navigation service is now due (the government application itself was free)`
            : " — pointer door, no fee"
        }`,
      );
      ctx.invalidateQueries();
      return {
        found: true,
        view: await loadJourneyView(ctx, journey),
        selfServiceFee: SELF_SERVICE_FEE,
      };
    },
  }),

  updateDoorFee: defineAction({
    description:
      "Records payment of a door's self-service navigation success fee in Center operations (fee due → paid). Guided-tier doors only; the fee is the flat $25 stored on the completion. Staff only: the caller must present the admin code, checked server-side (hardening, 2026-11-13).",
    request: z.object({
      adminCode: z.string().min(1).max(100),
      journeyNumber: z.string().min(4).max(30),
      doorId: z.enum(Object.keys(DOORS) as [DoorId, ...DoorId[]]),
      feeStatus: z.enum(["due", "paid"]),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      if (!(await adminCodeMatches(ctx, args.adminCode))) {
        throw new Error("Admin access denied — that code is not correct. Operations stay locked.");
      }
      const db = ctx.db<typeof schema>();
      const journeys = await db
        .select()
        .from(schema.journeys)
        .where(eq(schema.journeys.journeyNumber, args.journeyNumber))
        .limit(1);
      const journey = journeys[0];
      if (!journey) throw new Error("Journey not found.");
      const rows = await db
        .select()
        .from(schema.doorProgress)
        .where(eq(schema.doorProgress.journeyId, journey.id))
        .limit(100);
      const current = rows.find((p) => p.doorId === args.doorId);
      if (!current || current.feeStatus === "none") {
        throw new Error("That door carries no self-service fee.");
      }
      await db
        .update(schema.doorProgress)
        .set({ feeStatus: args.feeStatus, updatedAt: new Date() })
        .where(eq(schema.doorProgress.id, current.id));
      await logEvent(
        ctx,
        null,
        "door_fee_update",
        `Journey ${journey.journeyNumber}: the $${current.feeAmount} self-service navigation fee for “${DOORS[args.doorId].name}” is now “${args.feeStatus}”.`,
      );
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  confirmEmailReportsSent: defineAction({
    description:
      "Callback for the Center's email-sending task: marks generated email reports as sent once they have actually been delivered by email.",
    request: z.object({ reportIds: z.array(z.number().int().positive()).min(1).max(50) }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      for (const id of args.reportIds) {
        await db
          .update(schema.emailReports)
          .set({ status: "sent" })
          .where(eq(schema.emailReports.id, id));
      }
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  askAssistant: defineAction({
    description:
      "The on-site AI assistant: answers a visitor's question automatically from the Center's own verified content (services, prices, corrected Oklahoma 529 facts, the money-map doors and their conditions) in the visitor's selected language. General information only — never personal financial advice, never asks for passwords, Social Security numbers, or documents; anything it cannot answer is routed to booking a human sitting (needsHuman).",
    request: z.object({
      question: z.string().min(2).max(600),
      lang: z.enum(["en", "es", "vi", "zh", "lo", "hi"]).default("en"),
    }),
    response: z.object({ answer: z.string(), needsHuman: z.boolean() }),
    handler: async (ctx, args) => {
      const langName =
        args.lang === "es"
          ? "Spanish"
          : args.lang === "vi"
            ? "Vietnamese"
            : args.lang === "zh"
              ? "Simplified Chinese"
              : args.lang === "lo"
                ? "Lao"
                : args.lang === "hi"
                  ? "Hindi"
                  : "English";
      const knowledge = [
        "EDUCATION LIFE CENTER USA — verified facts. Answer ONLY from these facts.",
        "",
        "THE CENTER: a private membership company in Oklahoma City, now being prepared. It is NOT a government agency and claims no government approval or partnership. The Center guides families; it never lends, never touches 529 money, never holds any official-site password, and gives general education only — no personal investment advice, no tax preparation.",
        "",
        "FORMATION STATUS (state this plainly whenever a service's availability comes up): the Center is IN FORMATION — Education Life Center USA, LLC has not been filed yet and its bank account is not open. The membership WAITLIST is open now and is the one live intake. The 529 case door and the guided withdrawal sittings are OPENING SOON / in formation: they take NO cases and NO bookings yet, and NO fee is charged or collected for anything until the company is filed and its bank account exists. Families can still register themselves for free on the official websites through the self-service doors today.",
        "",
        "SERVICES AND PRICES (never change these numbers):",
        "- 529 case door (OPENING SOON — in formation, not taking cases yet; when it opens, no membership is needed): the Center guides a parent through opening one child's Oklahoma 529 account — goal calculated, plan explained, account opened, first contribution arranged. Flat fee $99 founding price for the first 50 completed cases, then $149 standard. Due ONLY on success; an unfinished case costs nothing. Advisor-sold OklahomaDream 529 cases carry no success fee.",
        "- Guided Withdrawal sitting (OPENING SOON — in formation, not taking bookings yet): when money must come OUT of a 529, the account owner requests the withdrawal themselves on the state plan's site while the Center guides — expense checked, destination chosen (straight to the school is cleanest), same-calendar-year rule, receipts and Form 1099-Q explained. Flat $199 per completed sitting, due only on completion, never a percentage of the withdrawal. No credit score, credit check, income test, or approval is needed for a 529 withdrawal — it is the family's own savings, not a loan.",
        "- Membership (opens later; today a free waitlist — joining activates nothing): tiers Starter $15/month, Family $25/month, Family Plus $40/month; children covered free on family tiers. Membership includes the Member Card, 529 Access (goal tracking + reminders), Job Promotion, and Family Credit Support (applications routed to partner banks/credit unions — the Center never lends; credit decisions and any credit check belong to the bank). Term Advance is parked — coming later, not open.",
        "- Referral reward: a member who brings more than 10 people who actually subscribe earns one free year; blocks of 10 stack.",
        "- SELF-SERVICE DOORS + $25 NAVIGATION FEE: every door on the site links to the OFFICIAL website where the family registers themselves (Oklahoma 529 enrolment, FAFSA at studentaid.gov, Oklahoma's Promise, OkTAP, OKDHSLive, VA.gov, the tribal portals, OSRHE pages). Government applications are ALWAYS FREE. If a family completes a GUIDED-tier door entirely by self-service through our dashboard and reports the completion, a flat $25 success fee falls due — it pays for the Center's navigation service (matched door list, step guidance, this AI help, journey tracking, email reports, the completion record on file), never for a government form, application, or benefit. Pointer-tier doors carry no fee. Completions are self-reported by the family; official sites do not report back to the Center. A self-service completion does not use a founding guided-case spot.",
        "",
        "OKLAHOMA 529 FACTS (checked against oklahoma529.com and official sources):",
        "- Oklahoma 529 is the state's direct plan, managed by TIAA-CREF Tuition Financing, Inc. (TFI); OklahomaDream 529 is advisor-sold, managed by Fidelity Investments, with a $20 annual account fee (waivable) and 0.20% administration fee. The direct plan has no opening fee and no annual account fee; its investment options carry annual asset-based fees of 0.15%–0.36%.",
        "- Open with $25; minimum contribution $25. No credit check, score, or income test to open or withdraw. Anyone 18+ with an SSN or ITIN and a permanent U.S. address can open an account for any beneficiary — no kinship, income, or Oklahoma-residency requirement.",
        "- The $450,000 figure is the maximum combined ACCOUNT BALANCE per beneficiary across both Oklahoma plans (there is no maximum contribution limit).",
        "- Oklahoma state tax deduction: $10,000 per return per year ($20,000 joint), excess carried forward up to five years; contributions count if made by the later of April 15 or the return's due date (excluding extensions); the deduction is recaptured if the money is later withdrawn for non-qualified expenses.",
        "- Qualified expenses include college costs and, from tax year 2026, ALL K-12 expenses combined up to $20,000 a year (tuition, curriculum and books, online materials, tutoring, test fees, dual-enrollment fees, therapies). Student-loan repayment: up to $10,000 lifetime per beneficiary, plus $10,000 for each sibling. Parent PLUS: a parent's PLUS loan does NOT qualify while the student is the beneficiary, but the owner can change the beneficiary to the parent borrower, after which up to $10,000 qualifies under the parent's own lifetime limit.",
        "- Withdrawals: only the account owner requests them; money can go to the owner, the beneficiary, the school (cleanest), another 529 plan, or a third party (non-qualified withdrawals only to owner or beneficiary). Holds: a contribution cannot be withdrawn until 8 business days after the plan receives it; 20 business days after a mailing-address change; 30 calendar days after a banking-information change; a medallion signature guarantee is required for withdrawal requests of $100,000 or more. Plan ahead — the Center's rule is to start at least two weeks before a payment deadline. Keep receipts: the plan does not check them at withdrawal, but the IRS or Oklahoma may ask. Form 1099-Q is furnished by January 31 after the withdrawal year.",
        "- Non-qualified withdrawals: contributions come back tax-free; earnings are taxed plus a 10% federal penalty — EXCEPT the penalty (not the tax) is waived for scholarship or other tax-free educational assistance, death, permanent disability, U.S. military academy attendance, and expenses counted toward an education tax credit.",
        "- Roth IRA rollover: up to $35,000 lifetime from a 529 to the beneficiary's Roth IRA if the account is 15+ years old, the money moved was contributed 5+ years ago, it moves directly plan-to-Roth, and it counts against the beneficiary's annual Roth limit (so it cannot exceed their earned income that year); the usual Roth income limits are waived for these rollovers.",
        "- A 529 is never a loan and cannot be pledged as security (IRC §529(b)(5)); there is no account expiry; the beneficiary can be changed to another family member.",
        "- Published totals (Dec 31, 2025, College Savings Plans Network): Oklahoma's two plans held 89,849 accounts and $1,975,235,961; U.S. 529 plans held 17,686,941 accounts and $602,921,629,890. The median 529 account size was $9,500 in Q4 2025 (College Savings Foundation). These are the state plans' numbers, not the Center's customers.",
        "",
        "MONEY-MAP DOORS (families register themselves on the official sites):",
        "GUIDED doors: Oklahoma 529 account opening; Oklahoma 529 withdrawal; FAFSA (Federal Pell Grant up to $7,395 a year, no fixed income cutoff — filing the FAFSA is free and also unlocks most state aid); Oklahoma's Promise (pays resident tuition at Oklahoma public colleges; apply from 8th grade through Dec 31 of the senior year; family AGI limits $60,000/$70,000/$80,000 by number of dependent children, with a $100,000 cap checked again in college); Parental Choice Tax Credit ($5,000–$7,500 per student toward private school by income tier, applied on OkTAP with an Enrollment Verification Number from the school); Child Care Subsidy via OKDHSLive (for parents working or in school/training); VA Chapter 35 ($1,574 a month full-time for a dependent of a veteran who died or is permanently and totally disabled from service) and the Fry Scholarship (full public tuition + housing + books for children/surviving spouses of members who died in the line of duty) — both applied on VA.gov with Form 22-5490, and a family eligible for both must choose one; Inspired to Teach (up to $25,500 total for future Oklahoma teachers who teach five years in Oklahoma public schools); Concurrent Enrollment Tuition Waiver (high-school juniors/seniors earning college credit); Foster Care Tuition Waiver (resident tuition at public colleges for youth who were in DHS custody at least nine months between ages 16 and 18, usable to age 26); Oklahoma National Guard Educational Assistance (tuition and approved fees at public colleges for Guard members); tribal higher-education programmes for citizens of the Cherokee Nation (Gadugi Portal — FAFSA first; community service hours required), Choctaw Nation (Chahta Achvffa portal, apply each semester), Chickasaw Nation (grants and career-tech support up to $6,000), Muscogee Nation (Camphouse Portal) and Osage Nation (per-credit scholarship; apply each year).",
        "POINTER doors (no fee, one line each): FSEOG and Federal Work-Study (arrive through the FAFSA and the school); OTAG (up to $1,500/$2,000/$3,000 by institution, through the FAFSA); OTEG ($2,000 at eligible private non-profit colleges; official published income limit $50,000); American Opportunity Tax Credit (up to $2,500 per student per year, claimed on the tax return) and Lifetime Learning Credit (up to $2,000 per return); Rising Scholars Award (automatic by test scores at public colleges); Reach Higher Finish Line Scholarships (adults finishing a degree); CareerTech financial aid (through the FAFSA and the technology center); Oklahoma ABLE / OK STABLE (savings for a person whose disability began before age 26, without risking benefits).",
        "",
        "HOW TO REACH A HUMAN: the Center is in formation, so the guided 529 case door and the guided withdrawal sittings are not taking cases or bookings yet — they open once Education Life Center USA, LLC is filed and its bank account exists. The live step today is the free membership waitlist on this page: joining saves the family's name and contact, and the Center invites waitlist families first when the doors open. A human sitting is the answer whenever a family's situation is personal or complicated.",
      ].join("\n");
      const result = await ctx.inference.complete(
        `Answer this visitor's question using ONLY the verified facts provided. Write the answer in ${langName}. Keep it plain, warm, and short (2–5 sentences). If the exact fact is not in the provided material, or the question asks for personal financial advice, a personal eligibility decision, tax preparation, or anything about the visitor's own accounts, documents, passwords, or Social Security number, set needsHuman to true and use the answer to warmly route them to the free membership waitlist on this page (the Center is in formation — the guided case door and withdrawal sittings open soon and take no bookings yet) — never guess. Never ask the visitor for a password, Social Security number, or document. Never invent a price, amount, deadline, or rule.\n\nVisitor's question: ${args.question}`,
        {
          system: knowledge,
          schema: z.object({ answer: z.string(), needsHuman: z.boolean() }),
          timeout_secs: 60,
        },
      );
      return { answer: result.answer, needsHuman: result.needsHuman };
    },
  }),

  joinWaitlist: defineAction({
    description:
      "Joins the membership waitlist while the membership is not open yet: saves the person's name and contact with a confirmation and their place in line. Nothing is activated — no member number, no member card, no invoice, no referral code. Re-joining with the same email updates the saved entry instead of adding a duplicate.",
    request: z.object({
      fullName: z.string().min(2).max(120),
      email: z.string().email().max(160),
      phone: z.string().max(30).default(""),
      city: z.string().min(1).max(80).default("Oklahoma City"),
      interestedTier: z.enum(["starter", "family", "family_plus"]).optional(),
      note: z.string().max(500).default(""),
    }),
    response: joinWaitlistResponse,
    handler: async (ctx, args): Promise<z.infer<typeof joinWaitlistResponse>> => {
      const db = ctx.db<typeof schema>();
      const existing = await db
        .select()
        .from(schema.membershipWaitlist)
        .where(eq(schema.membershipWaitlist.email, args.email))
        .limit(1);
      let row = existing[0];
      let alreadyOnList = false;
      if (row) {
        alreadyOnList = true;
        await db
          .update(schema.membershipWaitlist)
          .set({
            fullName: args.fullName,
            phone: args.phone,
            city: args.city,
            interestedTier: args.interestedTier ?? row.interestedTier,
            note: args.note,
            updatedAt: new Date(),
          })
          .where(eq(schema.membershipWaitlist.id, row.id));
        const refreshed = await db
          .select()
          .from(schema.membershipWaitlist)
          .where(eq(schema.membershipWaitlist.id, row.id))
          .limit(1);
        row = refreshed[0] ?? row;
      } else {
        const inserted = await db
          .insert(schema.membershipWaitlist)
          .values({
            fullName: args.fullName,
            email: args.email,
            phone: args.phone,
            city: args.city,
            interestedTier: args.interestedTier ?? null,
            note: args.note,
          })
          .returning({ id: schema.membershipWaitlist.id });
        const newId = inserted[0]?.id;
        if (!newId) throw new Error("The waitlist entry could not be saved. Please try again.");
        const rows = await db
          .select()
          .from(schema.membershipWaitlist)
          .where(eq(schema.membershipWaitlist.id, newId))
          .limit(1);
        row = rows[0];
        if (!row) throw new Error("The waitlist entry could not be saved. Please try again.");
        await logEvent(
          ctx,
          null,
          "waitlist_joined",
          `Membership waitlist: ${args.fullName} (${args.email}) joined — the membership is not open yet, so nothing was activated; the Center will invite them when it opens.`,
        );
      }
      const all = await db
        .select({ id: schema.membershipWaitlist.id })
        .from(schema.membershipWaitlist)
        .orderBy(asc(schema.membershipWaitlist.id));
      const position = all.findIndex((r) => r.id === row.id) + 1;
      ctx.invalidateQueries();
      return {
        alreadyOnList,
        totalOnList: all.length,
        entry: {
          id: row.id,
          fullName: row.fullName,
          email: row.email,
          phone: row.phone,
          city: row.city,
          interestedTier: row.interestedTier,
          note: row.note,
          position,
          joinedAt: row.createdAt.toISOString(),
        },
      };
    },
  }),

  subscribe: defineAction({
    description:
      "The public subscribe entry to the participant pipeline: saves the membership application, reserves the member number, issues the access key and the fee invoice with its bank payment reference; the membership sits in awaiting_payment until operations confirms the bank payment, which activates it and issues the electronic card automatically. PARKED while the membership is on a waitlist (Founder, 2026-11-11): refuses new applications until the Center opens the membership; use joinWaitlist meanwhile — applyForMembership runs the same pipeline for staff-assisted applications.",
    request: z.object({
      fullName: z.string().min(2).max(120),
      email: z.string().email().max(160),
      phone: z.string().min(7).max(30),
      city: z.string().min(1).max(80).default("Oklahoma City"),
      state: z.string().min(1).max(40).default("OK"),
      tier: z.enum(["starter", "family", "family_plus"]),
      referralCode: z.string().max(20).optional(),
      children: z
        .array(
          z.object({
            name: z.string().min(1).max(80),
            birthYear: z.number().int().min(1990).max(2026),
            schoolLevel: z.string().max(60).default(""),
          }),
        )
        .max(10)
        .default([]),
    }),
    response: subscribeResponse,
    handler: async (ctx, args): Promise<z.infer<typeof subscribeResponse>> => {
      // PARKED (Founder, 2026-11-11): the membership is on a waitlist until
      // it opens. New activations through the public subscribe are refused
      // while it is parked — joinWaitlist saves the name and contact
      // instead. Existing members are unaffected. When the Founder orders
      // the opening and this flag flips, subscribe runs the participant
      // pipeline (createMembershipApplication): application →
      // awaiting_payment → bank fee → automatic activation + e-card.
      if (!MEMBERSHIP_OPEN) {
        throw new Error(
          "The membership is not open yet — it is on a waitlist. Join the waitlist and the Center will invite you when the membership opens. The Center is in formation: the 529 case door and guided withdrawal sittings open soon, once Education Life Center USA, LLC is filed and its bank account exists — no cases are being taken and no fees are collected yet.",
        );
      }
      return createMembershipApplication(ctx, args);
    },
  }),

  applyForMembership: defineAction({
    description:
      "The participant pipeline's application step (Founder, 2026-11-13): saves a membership application online — family tiers Starter $15 / Family $25 / Family Plus $40 monthly, children covered free — reserves the member number, issues the member's personal access key, and issues the fee invoice with its unique bank payment reference. The membership sits in 'awaiting_payment' and NO card is issued until confirmBankPayment records the fee at the Center's bank. Used for staff-assisted applications and end-to-end verification while the public subscribe stays parked on the waitlist; it is the same shared pipeline subscribe will run at opening — not a second system. FORMATION MODE (Founder, 2026-11-13): while FORMATION_MODE is true this action refuses — it issues a fee invoice and a bank payment reference, which is a payment step, and no payment step is active until Education Life Center USA, LLC is filed and its bank account exists; the waitlist is the live intake.",
    request: z.object({
      fullName: z.string().min(2).max(120),
      email: z.string().email().max(160),
      phone: z.string().min(7).max(30),
      city: z.string().min(1).max(80).default("Oklahoma City"),
      state: z.string().min(1).max(40).default("OK"),
      tier: z.enum(["starter", "family", "family_plus"]),
      referralCode: z.string().max(20).optional(),
      children: z
        .array(
          z.object({
            name: z.string().min(1).max(80),
            birthYear: z.number().int().min(1990).max(2026),
            schoolLevel: z.string().max(60).default(""),
          }),
        )
        .max(10)
        .default([]),
    }),
    response: subscribeResponse,
    handler: async (ctx, args): Promise<z.infer<typeof subscribeResponse>> => {
      // FORMATION MODE: issuing a fee invoice is a payment step — inactive
      // until the LLC is filed and its bank account exists.
      if (FORMATION_MODE) throw new Error(FORMATION_PAYMENT_MESSAGE);
      return createMembershipApplication(ctx, args);
    },
  }),

  confirmBankPayment: defineAction({
    description:
      "Operations confirms a membership fee arrived at the Center's bank account, by the invoice's payment reference (admin code required, checked server-side). On confirmation the system automatically: marks the invoice paid, writes the numbered receipt, activates the membership, issues the electronic member card (member number + QR), settles any referral progress, and generates the confirmation email reports — the family copy carries the member's electronic card details. Re-confirming an already-paid reference is a no-op that reports the current state.",
    request: z.object({
      adminCode: z.string().min(1).max(100),
      paymentReference: z.string().min(3).max(60),
    }),
    response: z.object({
      ok: z.literal(true),
      alreadyPaid: z.boolean(),
      memberNumber: z.string(),
      memberStatus: z.string(),
      cardIssued: z.boolean(),
      cardStatus: z.string(),
      receiptNumber: z.string(),
      invoiceNumber: z.string(),
    }),
    handler: async (ctx, args): Promise<{
      ok: true;
      alreadyPaid: boolean;
      memberNumber: string;
      memberStatus: string;
      cardIssued: boolean;
      cardStatus: string;
      receiptNumber: string;
      invoiceNumber: string;
    }> => {
      if (!(await adminCodeMatches(ctx, args.adminCode))) {
        throw new Error("Admin access denied — that code is not correct. Nothing was confirmed.");
      }
      // FORMATION MODE: the admin gate above is unchanged, but no fee can
      // be confirmed as collected — the Center's bank account does not
      // exist until the LLC is filed and the account is opened.
      if (FORMATION_MODE) throw new Error(FORMATION_PAYMENT_MESSAGE);
      const db = ctx.db<typeof schema>();
      const reference = args.paymentReference.trim().toUpperCase();
      const invRows = await db
        .select()
        .from(schema.invoices)
        .where(eq(schema.invoices.paymentReference, reference))
        .limit(1);
      const invoice = invRows[0];
      if (!invoice) throw new Error("No fee invoice carries that payment reference — check the reference and try again.");
      const memberRows = await db
        .select()
        .from(schema.members)
        .where(eq(schema.members.id, invoice.memberId))
        .limit(1);
      const member = memberRows[0];
      if (!member) throw new Error("The member for that invoice could not be found.");
      const cardRows = await db
        .select()
        .from(schema.memberCards)
        .where(eq(schema.memberCards.memberId, member.id))
        .limit(1);
      const existingCard = cardRows[0];
      const payRows = await db
        .select()
        .from(schema.payments)
        .where(eq(schema.payments.invoiceId, invoice.id))
        .limit(1);
      const existingReceipt = payRows[0]?.receiptNumber ?? "";
      if (invoice.status === "paid") {
        return {
          ok: true as const,
          alreadyPaid: true,
          memberNumber: member.memberNumber,
          memberStatus: member.status,
          cardIssued: existingCard != null,
          cardStatus: existingCard ? (member.status === "active" && existingCard.status === "active" ? "active" : "lapsed") : "awaiting_payment",
          receiptNumber: existingReceipt,
          invoiceNumber: invoice.invoiceNumber,
        };
      }
      if (invoice.status !== "awaiting_bank_payment") {
        throw new Error(`Invoice ${invoice.invoiceNumber} is not awaiting a bank payment (its status is ${invoice.status.replace(/_/g, " ")}).`);
      }
      // 1) Invoice paid + numbered receipt.
      await db
        .update(schema.invoices)
        .set({ status: "paid" })
        .where(eq(schema.invoices.id, invoice.id));
      const receiptNumber = `RCP-${pad(invoice.id, 6)}`;
      await db.insert(schema.payments).values({
        memberId: member.id,
        invoiceId: invoice.id,
        amount: invoice.amount,
        method: "bank_transfer",
        provider: "Center bank account — paid by reference",
        receiptNumber,
        status: "confirmed",
      });
      await logEvent(ctx, member.id, "bank_payment_confirmed",
        `Your $${invoice.amount} membership fee was confirmed at the Center's bank account (reference ${reference}, invoice ${invoice.invoiceNumber}). Receipt ${receiptNumber}.`);
      // 2) Membership activates automatically.
      await db
        .update(schema.members)
        .set({ status: "active" })
        .where(eq(schema.members.id, member.id));
      // 3) Electronic member card issued automatically (if not already).
      let cardIssued = existingCard != null;
      if (!existingCard) {
        await db.insert(schema.memberCards).values({
          memberId: member.id,
          cardNumber: cardNumberFor(member.id),
          status: "active",
        });
        cardIssued = true;
        await logEvent(ctx, member.id, "card_issued",
          `Your electronic member card was issued automatically — member number ${member.memberNumber}. Open your dashboard on your phone to show the card and its QR code at partner stores for your member reduction and benefits.`);
      }
      await logEvent(ctx, member.id, "membership_activated",
        `Welcome to Education Life Center USA — your membership is ACTIVE. Member number ${member.memberNumber}; Job Promotion and Family Credit Support are open on your dashboard, and 529 Access is included. Term Advance opens later.`);
      // 4) Referral progress settles on activation, not on application.
      if (member.referredByCode) {
        const refRows = await db
          .select()
          .from(schema.members)
          .where(eq(schema.members.referralCode, member.referredByCode))
          .limit(1);
        const referrer = refRows[0];
        if (referrer) {
          await logEvent(ctx, referrer.id, "referral_joined",
            `${member.fullName} joined with your referral code ${referrer.referralCode} and their membership is now active.`);
          await settleReferralReward(ctx, referrer);
        }
      }
      // 5) Confirmation email reports (family copy carries the e-card).
      const tierInfo = TIERS[member.tier as TierKey] ?? TIERS.starter;
      const familySubject = `Your membership is active — your electronic member card — ${member.memberNumber}`;
      const familyBody = [
        `Hello ${member.fullName},`,
        "",
        `Good news: your $${invoice.amount} membership fee was confirmed at the Center's bank account (payment reference ${reference}). Your membership is now ACTIVE.`,
        "",
        "Your electronic member card:",
        `- Member number: ${member.memberNumber}`,
        `- Plan: ${tierInfo.label} — $${tierInfo.monthly}/month`,
        "- Card status: active",
        "- Show this card on your phone — open your member dashboard to display it with its QR code — at partner stores for your member reduction and benefits. A partner store can verify the card from the member number alone; it never sees your family's private details.",
        "",
        `Receipt: ${receiptNumber} for invoice ${invoice.invoiceNumber}.`,
        "",
        "Education Life Center USA — Oklahoma City. We guide; we never touch your 529 money, and we never ask for any official-site password.",
      ].join("\n");
      const centerSubject = `Center activity report — membership activated ${member.memberNumber}`;
      const centerBody = [
        `Member: ${member.memberNumber} — ${member.fullName} (${member.email})`,
        `Event: bank payment confirmed (reference ${reference}, invoice ${invoice.invoiceNumber}, $${invoice.amount}); membership activated; electronic card issued. Receipt ${receiptNumber}.`,
      ].join("\n");
      const insertedReports = await db
        .insert(schema.emailReports)
        .values([
          { journeyId: null, kind: "family_summary", event: "membership_activated", recipient: member.email, subject: familySubject, body: familyBody },
          { journeyId: null, kind: "center_activity", event: "membership_activated", recipient: "center", subject: centerSubject, body: centerBody },
        ])
        .returning({ id: schema.emailReports.id });
      const reportIds = insertedReports.map((r) => r.id).filter((n) => n > 0);
      if (reportIds.length > 0) {
        try {
          await ctx.agent.spawnTask(
            [
              "Send two emails for Education Life Center USA using the connected Gmail account, exactly as written below — do not change the wording, amounts, or numbers.",
              "",
              `EMAIL 1 — to the family at ${member.email}`,
              `Subject: ${familySubject}`,
              "Body:",
              familyBody,
              "",
              "EMAIL 2 — to the Center: send it to the Gmail account owner's own inbox (the Center operator reads it there).",
              `Subject: ${centerSubject}`,
              "Body:",
              centerBody,
              "",
              `When both emails are sent, call the confirmEmailReportsSent action of this artifact with reportIds [${reportIds.join(", ")}]. If an email cannot be sent, do not call the action for it and do not retry more than once. Do not message the user in chat about these emails.`,
            ].join("\n"),
            { expectsAction: "confirmEmailReportsSent", dedupeKey: `elc-member-activated-${member.id}` },
          );
        } catch {
          // Delivery is best-effort — the reports stay "recorded" on file.
        }
      }
      ctx.invalidateQueries();
      return {
        ok: true as const,
        alreadyPaid: false,
        memberNumber: member.memberNumber,
        memberStatus: "active",
        cardIssued,
        cardStatus: "active",
        receiptNumber,
        invoiceNumber: invoice.invoiceNumber,
      };
    },
  }),

  verifyMemberCard: defineAction({
    description:
      "Partner-store card verification (Founder, 2026-11-13): a partner store enters or scans a member number (the card's QR code encodes exactly this number) and sees ONLY whether the card is valid, the member's tier, and the card status — never the member's name, contact details, children, or any other private family data.",
    request: z.object({ memberNumber: z.string().min(3).max(40) }),
    response: z.object({
      found: z.boolean(),
      valid: z.boolean(),
      memberNumber: z.string(),
      tier: z.string(),
      tierLabel: z.string(),
      cardStatus: z.string(),
    }),
    handler: async (ctx, args): Promise<{
      found: boolean;
      valid: boolean;
      memberNumber: string;
      tier: string;
      tierLabel: string;
      cardStatus: string;
    }> => {
      const db = ctx.db<typeof schema>();
      const wanted = args.memberNumber.trim().toUpperCase();
      const rows = await db
        .select()
        .from(schema.members)
        .where(eq(schema.members.memberNumber, wanted))
        .limit(1);
      const member = rows[0];
      if (!member) {
        return { found: false, valid: false, memberNumber: wanted, tier: "", tierLabel: "", cardStatus: "not_found" };
      }
      const cardRows = await db
        .select()
        .from(schema.memberCards)
        .where(eq(schema.memberCards.memberId, member.id))
        .limit(1);
      const card = cardRows[0];
      const cardStatus = !card
        ? "awaiting_payment"
        : member.status === "active" && card.status === "active"
          ? "active"
          : "lapsed";
      const tierInfo = TIERS[member.tier as TierKey] ?? TIERS.starter;
      return {
        found: true,
        valid: cardStatus === "active",
        memberNumber: member.memberNumber,
        tier: member.tier,
        tierLabel: tierInfo.label,
        cardStatus,
      };
    },
  }),

  seedResearchedJobs: defineAction({
    description:
      "Loads the 15 Oklahoma City metro jobs verified open on 2026-11-13 on the employers' own official sites (research report, 2026-11-13) into the members-only Job Promotion board. Idempotent: a listing whose employer + title already exists is skipped, so re-running never duplicates. Excludes everything on the research report's closed/excluded list. Each listing keeps its official application URL, pay exactly as published (or 'Not published'), requirements, and any apply-by deadline. Staff only: the caller must present the admin code, checked server-side (hardening, 2026-11-13); the primary seeding route is db/seed-jobs.sql.",
    request: z.object({ adminCode: z.string().min(1).max(100) }),
    response: z.object({ ok: z.literal(true), inserted: z.number(), skipped: z.number() }),
    handler: async (ctx, args): Promise<{ ok: true; inserted: number; skipped: number }> => {
      if (!(await adminCodeMatches(ctx, args.adminCode))) {
        throw new Error("Admin access denied — that code is not correct. Operations stay locked.");
      }
      const db = ctx.db<typeof schema>();
      const jobs: {
        employerName: string; title: string; location: string; payRange: string;
        employmentType: string; requirements: string; deadline: string; applyUrl: string;
      }[] = [
        { employerName: "State of Oklahoma — Service Oklahoma", title: "Legal Assistant", location: "Oklahoma County (Oklahoma City)", payRange: "Annual rate of $44,000", employmentType: "Full time", requirements: "Preferred minimum: one year of clerical office experience; no degree stated. (Req JR67713)", deadline: "Apply by 22 Nov 2026", applyUrl: "https://okgov.wd1.myworkdayjobs.com/en-US/okgovjobs/job/Oklahoma-County/Legal-Support-Specialist_JR67713" },
        { employerName: "State of Oklahoma — Service Oklahoma", title: "Performance and Analytics Manager", location: "Oklahoma County (Oklahoma City)", payRange: "Annual rate of $65,000.00", employmentType: "Full time", requirements: "Bachelor's in Business/Data Science/Analytics/Information Systems + 1 yr progressive project-management experience, OR 4 yrs business/data analysis experience, OR equivalent. (Req JR67785 — search it on the State portal)", deadline: "", applyUrl: "https://okgov.wd1.myworkdayjobs.com/okgovjobs" },
        { employerName: "Oklahoma Human Services (OKDHS)", title: "Case Manager I/II: Hiring Event 11/17/2026 OKC", location: "Oklahoma County and surrounding areas", payRange: "Level I $40,000.87 + state benefits; Level II $43,000.94 + state benefits", employmentType: "Not stated on the posting", requirements: "Level I: bachelor's in a human-services field + 1 yr professional experience working directly with individuals with intellectual/developmental disabilities (or valid permanent Oklahoma RN licence + 1 yr such experience); valid driver's licence and car insurance; extensive travel. Hiring event 17 Nov 2026, 9am–2pm, 1124 NE 36th St, Oklahoma City.", deadline: "Hiring event 17 Nov 2026", applyUrl: "https://oklahomadepartmentofhumanservices.applytojob.com/apply/Qs4mK88H5c/Case-Manager-III-Hiring-Event-11172026-OKC" },
        { employerName: "City of Oklahoma City — Parks & Recreation", title: "Administrative Technician (Part-Time/Year-Round) - City", location: "420 W Main St, Oklahoma City, OK 73102", payRange: "Hourly Rate: $14.75 - $19.75", employmentType: "Part time (max 29 hrs/week)", requirements: "Must be at least 18 at application; advanced administrative/clerical support role, no degree requirement listed. (Job ID 4381)", deadline: "Apply before 10 Dec 2026", applyUrl: "https://fa-etyr-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_2/job/4381/?mode=job-location" },
        { employerName: "City of Oklahoma City — Police Dept, 911 Communications", title: "911 Dispatcher Trainee - City", location: "715 Robert S Kerr Ave, Oklahoma City, OK 73102", payRange: "Hourly Rate: $21.18 - $32.73 (Annual $44,223.84 - $68,340.24)", employmentType: "Full time", requirements: "High school graduate; must pass CritiCall online testing, background check and polygraph; shift work incl. nights/weekends/holidays. (Job ID 4365)", deadline: "Apply before 18 Nov 2026", applyUrl: "https://fa-etyr-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_2/job/4365/?mode=job-location" },
        { employerName: "City of Oklahoma City — Public Works / IT", title: "Senior Inventory Technician - City", location: "3738 SW 15th St, Oklahoma City, OK 73108", payRange: "Hourly Rate: $21.18 - $32.73 (Annual $44,223.84 - $68,340.24)", employmentType: "Full time", requirements: "Prior inventory/supply-room and clerical receiving/dispensing knowledge; valid driver licence (Operator); score 70%+ on 65-item job knowledge test; lift 25–75 lbs. (Job ID 4383)", deadline: "Apply before 26 Nov 2026", applyUrl: "https://fa-etyr-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_2/job/4383/?mode=job-location" },
        { employerName: "City of Oklahoma City — Utilities Dept, Southeast Water Supply", title: "Industrial Electrician - City", location: "Oklahoma City, OK", payRange: "Hourly Rate: $27.02 - $41.87 (Annual $56,417.76 - $87,424.56)", employmentType: "Full time", requirements: "Valid Oklahoma State and Oklahoma City Journeyman Wireman's License or higher + valid driver licence (Operator); journeyman-level industrial electrical experience. Apply through the City's official careers list — search 'Industrial Electrician'.", deadline: "", applyUrl: "https://fa-etyr-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_2/jobs?mode=job-location" },
        { employerName: "INTEGRIS Health", title: "Patient Access Specialist", location: "INTEGRIS Health Cancer Institute, Oklahoma City, OK", payRange: "Not published", employmentType: "Full time, Day Job", requirements: "1 year of Patient Access operations (scheduling/registration/insurance) or related experience; a 1100+ hr related Career Tech program or 1 year of related college coursework may substitute. (Job ID 116904)", deadline: "", applyUrl: "https://ertr.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_3001/job/116904/?keyword=Patient+Access+Specialist&mode=location" },
        { employerName: "INTEGRIS Health", title: "Medical Assistant - Wound Care Clinic", location: "INTEGRIS Health Wound Care Outpatient Clinic, Oklahoma City, OK", payRange: "Not published", employmentType: "Full time, Day Job", requirements: "Current nationally recognised Medical Assistant certification/registration OR 6 months clinic MA experience; CPR/BLS within 90 days of hire. (Job ID 115449)", deadline: "", applyUrl: "https://ertr.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_3001/job/115449/?keyword=Medical+Assistant&mode=location" },
        { employerName: "OU Health", title: "Patient Services Representative (PSR) - Urology Clinic", location: "Oklahoma City, OK", payRange: "Not published", employmentType: "Full time", requirements: "Level 1: HS diploma/GED + 1+ year professional work experience; no licence required. (Req R0068816)", deadline: "", applyUrl: "https://oumedicine.wd5.myworkdayjobs.com/en-US/OUHealthCareers/details/Patient-Services-Representative--PSR----Urology-Clinic_R0068816" },
        { employerName: "OU Health", title: "Pharmacy Inventory Control Specialist", location: "Oklahoma City, OK (Pharmacy dept)", payRange: "Not published", employmentType: "Full time", requirements: "HS diploma/GED + 3+ years as a pharmacy technician; Oklahoma pharmacy technician permit within 6 weeks of hire; national CPhT certification required. (Req R0070735)", deadline: "", applyUrl: "https://oumedicine.wd5.myworkdayjobs.com/en-US/OUHealthCareers/details/Pharmacy-Inventory-Control-Specialist_R0070735" },
        { employerName: "Oklahoma City Public Schools", title: "SPED Paraprofessional", location: "U.S. Grant High School, Oklahoma City, OK", payRange: "Not published", employmentType: "Full time", requirements: "HS diploma/GED plus one of: 48 college credit hours, passed OGET, ParaPro 455+, or WorkKeys 4+; SPED roles also need OSDE special-ed paraprofessional training and current CPR/First Aid. (Job ID 84)", deadline: "", applyUrl: "https://iazhqy.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/84/?lastSelectedFacet=CATEGORIES&selectedCategoriesFacet=300000007939320" },
        { employerName: "Oklahoma City Public Schools", title: "Media Center Assistant", location: "Heronville Elementary, Oklahoma City, OK", payRange: "Not published", employmentType: "Full time", requirements: "HS diploma/GED plus one of: associate degree or higher, 48 college credit hours, passed OGET, ParaPro 455+, or WorkKeys 4+. (Job ID 258)", deadline: "", applyUrl: "https://iazhqy.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/258/?lastSelectedFacet=CATEGORIES&selectedCategoriesFacet=300000007939320" },
        { employerName: "Oklahoma City Public Schools — Student Nutrition Services", title: "Kitchen Specialist", location: "Oklahoma City, OK (school sites as assigned)", payRange: "Not published", employmentType: "Full time — 6 hrs/day, 176 work days/yr (school year)", requirements: "HS diploma/GED preferred; valid driver's license; Food Protection Manager Certification (OSDH); safety-sensitive, pre-employment drug screen. (Job ID 106)", deadline: "", applyUrl: "https://iazhqy.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/106/?lastSelectedFacet=CATEGORIES&selectedCategoriesFacet=300000007908246" },
        { employerName: "Tinker AFB — Dept. of the Air Force (NAF)", title: "GOLF COURSE EQUIPMENT MECHANIC", location: "Tinker Golf Course, Tinker AFB, Oklahoma City, OK", payRange: "Not published", employmentType: "Not stated in the announcement", requirements: "Experience with tune-ups/engine overhauls (golf carts to dump trucks), grinders/presses, wiring, inventory and welding; valid driver's licence; background check, physical and drug testing. Open to everyone.", deadline: "Closes 17 Nov 2026", applyUrl: "https://www.usajobs.gov/job/891357800" },
      ];
      let inserted = 0;
      let skipped = 0;
      for (const job of jobs) {
        const sameEmployer = await db
          .select({ id: schema.jobListings.id, employerName: schema.jobListings.employerName })
          .from(schema.jobListings)
          .where(eq(schema.jobListings.title, job.title));
        if (sameEmployer.some((r) => r.employerName === job.employerName)) {
          skipped++;
          continue;
        }
        await db.insert(schema.jobListings).values({
          employerName: job.employerName,
          title: job.title,
          location: job.location,
          payRange: job.payRange,
          description: job.requirements,
          contactEmail: "",
          applyUrl: job.applyUrl,
          employmentType: job.employmentType,
          requirements: job.requirements,
          deadline: job.deadline,
          verifiedDate: "2026-11-13",
          status: "open",
        });
        inserted++;
      }
      if (inserted > 0) {
        await logEvent(ctx, null, "jobs_seeded",
          `${inserted} researched Oklahoma City job listings (verified open 2026-11-13 on the employers' official sites) loaded onto the members-only Job Promotion board.`);
      }
      ctx.invalidateQueries();
      return { ok: true as const, inserted, skipped };
    },
  }),

  findMember: defineAction({
    description:
      "Checks whether a member account exists for an email address, so a returning member knows whether they can open their dashboard. Returns only whether the account exists — never the member's ID (security correction, 2026-11-12).",
    request: z.object({ email: z.string().email().max(160) }),
    response: z.object({ found: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select({ id: schema.members.id })
        .from(schema.members)
        .where(eq(schema.members.email, args.email))
        .limit(1);
      return { found: rows.length > 0 };
    },
  }),

  getDashboard: defineAction({
    description:
      "Returns one member's full dashboard: card, children, service applications, invoices, job applications, referral progress, and the automation log. Requires the member's email AND their personal access key (issued at subscribe, stored only as a hash) — dashboards are never served by email or numeric ID alone (security correction, 2026-11-12).",
    request: z.object({
      email: z.string().email().max(160),
      accessKey: z.string().min(1).max(200),
    }),
    response: dashboardResponse,
    handler: async (ctx, args): Promise<z.infer<typeof dashboardResponse>> => {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.members)
        .where(eq(schema.members.email, args.email))
        .limit(1);
      const memberRow = rows[0];
      if (!memberRow) throw new Error("Member not found");
      if (
        !memberRow.accessKeyHash ||
        (await hashAccessKey(args.accessKey)) !== memberRow.accessKeyHash
      ) {
        throw new Error("Member access is not authorized — check your email and access key.");
      }
      const member = await loadMemberView(ctx, memberRow);

      const appRows = await db
        .select()
        .from(schema.applications)
        .where(eq(schema.applications.memberId, memberRow.id))
        .orderBy(desc(schema.applications.id));
      const invRows = await db
        .select()
        .from(schema.invoices)
        .where(eq(schema.invoices.memberId, memberRow.id))
        .orderBy(asc(schema.invoices.id));
      const eventRows = await db
        .select()
        .from(schema.automationEvents)
        .where(eq(schema.automationEvents.memberId, memberRow.id))
        .orderBy(desc(schema.automationEvents.id))
        .limit(30);
      const jobAppRows = await db
        .select({
          id: schema.jobApplications.id,
          listingId: schema.jobApplications.listingId,
          status: schema.jobApplications.status,
          createdAt: schema.jobApplications.createdAt,
          title: schema.jobListings.title,
          employerName: schema.jobListings.employerName,
        })
        .from(schema.jobApplications)
        .innerJoin(
          schema.jobListings,
          eq(schema.jobApplications.listingId, schema.jobListings.id),
        )
        .where(eq(schema.jobApplications.memberId, memberRow.id))
        .orderBy(desc(schema.jobApplications.id));

      const plan529Rows = await db
        .select()
        .from(schema.plans529)
        .where(eq(schema.plans529.memberId, memberRow.id))
        .orderBy(desc(schema.plans529.id));
      const pmRows = await db
        .select()
        .from(schema.paymentMethods)
        .where(eq(schema.paymentMethods.memberId, memberRow.id))
        .limit(1);
      const pm = pmRows[0];
      const payRows = await db
        .select({
          id: schema.payments.id,
          amount: schema.payments.amount,
          method: schema.payments.method,
          provider: schema.payments.provider,
          receiptNumber: schema.payments.receiptNumber,
          status: schema.payments.status,
          createdAt: schema.payments.createdAt,
          invoiceNumber: schema.invoices.invoiceNumber,
        })
        .from(schema.payments)
        .innerJoin(schema.invoices, eq(schema.payments.invoiceId, schema.invoices.id))
        .where(eq(schema.payments.memberId, memberRow.id))
        .orderBy(desc(schema.payments.id));

      return {
        member,
        applications: appRows.map((a) => ({
          id: a.id,
          service: a.service,
          amount: a.amount,
          purpose: a.purpose,
          detail: a.detail,
          partner: a.partner,
          status: a.status,
          decision: a.decision,
          createdAt: a.createdAt.toISOString(),
        })),
        invoices: invRows.map((i) => ({
          id: i.id,
          invoiceNumber: i.invoiceNumber,
          paymentReference: i.paymentReference,
          periodLabel: i.periodLabel,
          amount: i.amount,
          status: i.status,
          createdAt: i.createdAt.toISOString(),
        })),
        events: eventRows.map((e) => ({
          id: e.id,
          kind: e.kind,
          message: e.message,
          createdAt: e.createdAt.toISOString(),
        })),
        paymentMethod: pm
          ? {
              method: pm.method,
              provider: pm.provider,
              last4: pm.last4,
              autoRenew: pm.autoRenew === 1,
            }
          : null,
        payments: payRows.map((p) => ({
          id: p.id,
          invoiceNumber: p.invoiceNumber,
          amount: p.amount,
          method: p.method,
          provider: p.provider,
          receiptNumber: p.receiptNumber,
          status: p.status,
          createdAt: p.createdAt.toISOString(),
        })),
        jobApplications: jobAppRows.map((j) => ({
          id: j.id,
          listingId: j.listingId,
          title: j.title,
          employerName: j.employerName,
          status: j.status,
          createdAt: j.createdAt.toISOString(),
        })),
        plans529: plan529Rows.map((p) => ({
          id: p.id,
          childName: p.childName,
          planChoice: p.planChoice,
          goalAmount: p.goalAmount,
          monthlyContribution: p.monthlyContribution,
          currentSaved: p.currentSaved,
          targetYear: p.targetYear,
          status: p.status,
          remindersOn: p.remindersOn === 1,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        })),
      };
    },
  }),

  addChild: defineAction({
    description: "Adds a child profile under a member's family membership.",
    request: z.object({
      memberId: z.number().int().positive(),
      accessKey: z.string().min(1).max(200),
      name: z.string().min(1).max(80),
      birthYear: z.number().int().min(1990).max(2026),
      schoolLevel: z.string().max(60).default(""),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      await requireMemberAccess(ctx, args.memberId, args.accessKey);
      const db = ctx.db<typeof schema>();
      await db.insert(schema.children).values({
        memberId: args.memberId,
        name: args.name,
        birthYear: args.birthYear,
        schoolLevel: args.schoolLevel,
      });
      await logEvent(
        ctx,
        args.memberId,
        "child_added",
        `Child profile added: ${args.name} (born ${args.birthYear}) — covered free under the family membership.`,
      );
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  setup529Plan: defineAction({
    description:
      "Creates a member's 529 Access savings goal: records the child, the Oklahoma state plan they chose (or undecided), their goal, monthly contribution, amount already saved, and target college year. The Center only guides and tracks — the parent opens the account directly with the state plan and money never passes through the Center.",
    request: z.object({
      memberId: z.number().int().positive(),
      accessKey: z.string().min(1).max(200),
      childName: z.string().min(1).max(80),
      planChoice: z.enum(["oklahoma_529", "oklahomadream_529", "undecided"]).default("undecided"),
      goalAmount: z.number().min(0).max(1000000).default(0),
      monthlyContribution: z.number().min(0).max(100000).default(0),
      currentSaved: z.number().min(0).max(1000000).default(0),
      targetYear: z.number().int().min(2026).max(2060).default(2040),
      remindersOn: z.boolean().default(true),
    }),
    response: z.object({ planId: z.number() }),
    async handler(ctx, args) {
      await requireMemberAccess(ctx, args.memberId, args.accessKey);
      const db = ctx.db<typeof schema>();
      const inserted = await db
        .insert(schema.plans529)
        .values({
          memberId: args.memberId,
          childName: args.childName,
          planChoice: args.planChoice,
          goalAmount: args.goalAmount,
          monthlyContribution: args.monthlyContribution,
          currentSaved: args.currentSaved,
          targetYear: args.targetYear,
          status: args.planChoice === "undecided" ? "guidance_requested" : "planning",
          remindersOn: args.remindersOn ? 1 : 0,
        })
        .returning({ id: schema.plans529.id });
      const planLabel =
        args.planChoice === "oklahoma_529"
          ? "Oklahoma 529 (direct, state plan)"
          : args.planChoice === "oklahomadream_529"
            ? "OklahomaDream 529 (advisor-sold, state plan)"
            : "529 plan — still choosing (guidance requested)";
      await logEvent(
        ctx,
        args.memberId,
        "529_goal_created",
        `529 Access goal created for ${args.childName}: ${planLabel}. Goal $${args.goalAmount.toLocaleString("en-US")} by ${args.targetYear}, planned contribution $${args.monthlyContribution.toLocaleString("en-US")}/month${args.remindersOn ? ", contribution reminders ON" : ""}. Next step: open the account directly on the state plan's official site — your money goes from you straight to the state plan; the Center never holds it.`,
      );
      ctx.invalidateQueries();
      return { planId: inserted[0]?.id ?? 0 };
    },
  }),

  update529Plan: defineAction({
    description:
      "Updates a member's 529 Access goal: amount saved so far, monthly contribution, goal, status (including marking the state-plan account as opened), and the reminder switch. Only the owning member's plan can be updated.",
    request: z.object({
      memberId: z.number().int().positive(),
      accessKey: z.string().min(1).max(200),
      planId: z.number().int().positive(),
      currentSaved: z.number().min(0).max(1000000).optional(),
      monthlyContribution: z.number().min(0).max(100000).optional(),
      goalAmount: z.number().min(0).max(1000000).optional(),
      planChoice: z.enum(["oklahoma_529", "oklahomadream_529", "undecided"]).optional(),
      status: z.enum(["planning", "guidance_requested", "account_opened", "tracking"]).optional(),
      remindersOn: z.boolean().optional(),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      await requireMemberAccess(ctx, args.memberId, args.accessKey);
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.plans529)
        .where(eq(schema.plans529.id, args.planId))
        .limit(1);
      const plan = rows[0];
      if (!plan || plan.memberId !== args.memberId) throw new Error("529 goal not found.");
      await db
        .update(schema.plans529)
        .set({
          currentSaved: args.currentSaved ?? plan.currentSaved,
          monthlyContribution: args.monthlyContribution ?? plan.monthlyContribution,
          goalAmount: args.goalAmount ?? plan.goalAmount,
          planChoice: args.planChoice ?? plan.planChoice,
          status: args.status ?? plan.status,
          remindersOn: args.remindersOn == null ? plan.remindersOn : args.remindersOn ? 1 : 0,
          updatedAt: new Date(),
        })
        .where(eq(schema.plans529.id, args.planId));
      const savedNow = args.currentSaved ?? plan.currentSaved;
      const goalNow = args.goalAmount ?? plan.goalAmount;
      if (args.status === "account_opened") {
        await logEvent(
          ctx,
          args.memberId,
          "529_account_opened",
          `529 Access: you marked the state-plan account for ${plan.childName} as opened. The account is held by the state plan in your name — the Center only tracks your goal here.`,
        );
      } else {
        await logEvent(
          ctx,
          args.memberId,
          "529_updated",
          `529 Access goal for ${plan.childName} updated: $${savedNow.toLocaleString("en-US")} saved toward a $${goalNow.toLocaleString("en-US")} goal.`,
        );
      }
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  applyService: defineAction({
    description:
      "Submits a Family Credit Support application; the system checks it and routes it to a partner bank or credit union automatically, and logs the routing. Term Advance is parked at start and refuses new applications.",
    request: z.object({
      memberId: z.number().int().positive(),
      accessKey: z.string().min(1).max(200),
      service: z.enum(["term_advance", "family_credit"]),
      amount: z.number().positive().max(1000000),
      purpose: z.string().min(2).max(200),
      detail: z.string().max(1000).default(""),
    }),
    response: z.object({
      applicationId: z.number(),
      partner: z.string(),
      status: z.string(),
    }),
    async handler(ctx, args) {
      await requireMemberAccess(ctx, args.memberId, args.accessKey);
      // Term Advance (Service 5) is parked at start (Founder, 2026-11-11):
      // built into the system, presented as coming later, not offered yet.
      if (args.service === "term_advance") {
        throw new Error(
          "Term Advance is not open yet — it is coming later. Family Credit Support applications are open.",
        );
      }
      const db = ctx.db<typeof schema>();
      const partners = PARTNERS[args.service];
      // Deterministic routing: spread applications across the partner desks.
      const countRows = await db
        .select({ id: schema.applications.id })
        .from(schema.applications)
        .where(eq(schema.applications.service, args.service));
      const partner = partners[countRows.length % partners.length] ?? partners[0] ?? "";
      const inserted = await db
        .insert(schema.applications)
        .values({
          memberId: args.memberId,
          service: args.service,
          amount: args.amount,
          purpose: args.purpose,
          detail: args.detail,
          partner,
          status: "with_partner",
        })
        .returning({ id: schema.applications.id });
      const appId = inserted[0]?.id ?? 0;
      const label = "Family Credit Support";
      await logEvent(
        ctx,
        args.memberId,
        "application_routed",
        `${label} application for $${args.amount.toLocaleString("en-US")} checked and routed automatically to ${partner}. The partner institution reviews it and makes the decision — the Center never lends directly.`,
      );
      ctx.invalidateQueries();
      return { applicationId: appId, partner, status: "with_partner" };
    },
  }),

  listJobs: defineAction({
    description:
      "Lists open job listings on the members-only Job Promotion board, newest first. MEMBERS ONLY (Founder, 2026-11-13): the caller must be a signed-in member — the member's email plus their personal access key are verified server-side, and unauthenticated calls are refused, so the list is never public data.",
    request: z.object({
      limit: z.number().int().positive().max(100).default(50),
      email: z.string().email().max(160),
      accessKey: z.string().min(1).max(200),
    }),
    response: z.object({ listings: z.array(listingShape) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const memberRows = await db
        .select()
        .from(schema.members)
        .where(eq(schema.members.email, args.email))
        .limit(1);
      const caller = memberRows[0];
      if (!caller) {
        throw new Error("The Job Promotion board is for members only — sign in with your member email and personal access key.");
      }
      await requireMemberAccess(ctx, caller.id, args.accessKey);
      const rows = await db
        .select()
        .from(schema.jobListings)
        .where(eq(schema.jobListings.status, "open"))
        .orderBy(desc(schema.jobListings.id))
        .limit(args.limit);
      const listings = [];
      for (const row of rows) {
        const apps = await db
          .select({ id: schema.jobApplications.id })
          .from(schema.jobApplications)
          .where(eq(schema.jobApplications.listingId, row.id));
        listings.push({
          id: row.id,
          employerName: row.employerName,
          title: row.title,
          location: row.location,
          payRange: row.payRange,
          description: row.description,
          applyUrl: row.applyUrl,
          employmentType: row.employmentType,
          requirements: row.requirements,
          deadline: row.deadline,
          verifiedDate: row.verifiedDate,
          createdAt: row.createdAt.toISOString(),
          applicationCount: apps.length,
        });
      }
      return { listings };
    },
  }),

  postJob: defineAction({
    description:
      "Posts a job opening to the Job Promotion board so members can apply; the listing goes live immediately.",
    request: z.object({
      employerName: z.string().min(2).max(120),
      title: z.string().min(2).max(120),
      location: z.string().min(2).max(120).default("Oklahoma City, OK"),
      payRange: z.string().max(80).default(""),
      description: z.string().max(1500).default(""),
      contactEmail: z.string().email().max(160),
    }),
    response: z.object({ listingId: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const inserted = await db
        .insert(schema.jobListings)
        .values({
          employerName: args.employerName,
          title: args.title,
          location: args.location,
          payRange: args.payRange,
          description: args.description,
          contactEmail: args.contactEmail,
        })
        .returning({ id: schema.jobListings.id });
      await logEvent(
        ctx,
        null,
        "job_posted",
        `New opening posted on the Job Promotion board: ${args.title} at ${args.employerName}.`,
      );
      ctx.invalidateQueries();
      return { listingId: inserted[0]?.id ?? 0 };
    },
  }),

  applyJob: defineAction({
    description:
      "Applies a member to a job listing; the system forwards the application to the employer automatically and tracks its status on the member dashboard.",
    request: z.object({
      memberId: z.number().int().positive(),
      accessKey: z.string().min(1).max(200),
      listingId: z.number().int().positive(),
      note: z.string().max(500).default(""),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      await requireMemberAccess(ctx, args.memberId, args.accessKey);
      const db = ctx.db<typeof schema>();
      const dup = await db
        .select()
        .from(schema.jobApplications)
        .where(eq(schema.jobApplications.memberId, args.memberId));
      if (dup.some((d) => d.listingId === args.listingId)) {
        return { ok: true as const };
      }
      await db.insert(schema.jobApplications).values({
        memberId: args.memberId,
        listingId: args.listingId,
        note: args.note,
        status: "sent_to_employer",
      });
      const listingRows = await db
        .select()
        .from(schema.jobListings)
        .where(eq(schema.jobListings.id, args.listingId))
        .limit(1);
      const listing = listingRows[0];
      await logEvent(
        ctx,
        args.memberId,
        "job_application",
        `Application forwarded automatically to ${listing?.employerName ?? "the employer"} for “${listing?.title ?? "the opening"}”.`,
      );
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  setupPaymentMethod: defineAction({
    description:
      "Saves a member's fintech payment method (card or bank transfer via the payment provider; only the last four digits are stored — full details stay on the provider's secure page) and the auto-renewal choice. FORMATION MODE (Founder, 2026-11-13): while FORMATION_MODE is true this action refuses — setting up a payment method is a payment step, and no payment step is active until Education Life Center USA, LLC is filed and its bank account exists.",
    request: z.object({
      memberId: z.number().int().positive(),
      accessKey: z.string().min(1).max(200),
      method: z.enum(["card", "bank_transfer"]),
      provider: z.string().min(2).max(80).default("Fintech payment provider"),
      last4: z.string().regex(/^\d{4}$/, "Enter the last 4 digits only"),
      autoRenew: z.boolean().default(true),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      await requireMemberAccess(ctx, args.memberId, args.accessKey);
      // FORMATION MODE: no payment step is active yet.
      if (FORMATION_MODE) throw new Error(FORMATION_PAYMENT_MESSAGE);
      const db = ctx.db<typeof schema>();
      const existing = await db
        .select({ id: schema.paymentMethods.id })
        .from(schema.paymentMethods)
        .where(eq(schema.paymentMethods.memberId, args.memberId))
        .limit(1);
      if (existing[0]) {
        await db
          .update(schema.paymentMethods)
          .set({
            method: args.method,
            provider: args.provider,
            last4: args.last4,
            autoRenew: args.autoRenew ? 1 : 0,
          })
          .where(eq(schema.paymentMethods.memberId, args.memberId));
      } else {
        await db.insert(schema.paymentMethods).values({
          memberId: args.memberId,
          method: args.method,
          provider: args.provider,
          last4: args.last4,
          autoRenew: args.autoRenew ? 1 : 0,
        });
      }
      const label = args.method === "card" ? "Card" : "Bank transfer";
      await logEvent(
        ctx,
        args.memberId,
        "payment_method",
        `Fintech payment method saved: ${label} •••• ${args.last4} via ${args.provider}. Payments are processed by the provider directly into the company's bank account${args.autoRenew ? "; automatic renewal is ON, so each month's invoice is paid and receipted by the system" : "; automatic renewal is OFF — you will pay each invoice yourself from your dashboard"}.`,
      );
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  payInvoice: defineAction({
    description:
      "Pays one of the member's invoices through their saved fintech payment method; the system confirms the payment and issues a numbered receipt automatically. FORMATION MODE (Founder, 2026-11-13): while FORMATION_MODE is true this action refuses — no fee is collected and no payment step is active until Education Life Center USA, LLC is filed and its bank account exists.",
    request: z.object({
      memberId: z.number().int().positive(),
      accessKey: z.string().min(1).max(200),
      invoiceId: z.number().int().positive(),
    }),
    response: z.object({
      receiptNumber: z.string(),
      amount: z.number(),
    }),
    async handler(ctx, args) {
      await requireMemberAccess(ctx, args.memberId, args.accessKey);
      // FORMATION MODE: no fee is collected yet.
      if (FORMATION_MODE) throw new Error(FORMATION_PAYMENT_MESSAGE);
      const db = ctx.db<typeof schema>();
      const pmRows = await db
        .select()
        .from(schema.paymentMethods)
        .where(eq(schema.paymentMethods.memberId, args.memberId))
        .limit(1);
      const pm = pmRows[0];
      if (!pm) throw new Error("Set up a fintech payment method first.");
      const invRows = await db
        .select()
        .from(schema.invoices)
        .where(eq(schema.invoices.id, args.invoiceId))
        .limit(1);
      const inv = invRows[0];
      if (!inv || inv.memberId !== args.memberId) throw new Error("Invoice not found.");
      if (inv.status === "paid") throw new Error("This invoice is already paid.");
      if (inv.status === "covered_by_referral_reward") {
        throw new Error("This invoice is covered by your referral reward — nothing to pay.");
      }
      const receiptNumber = `RCPT-${pad(args.memberId, 4)}-${pad(inv.id, 4)}`;
      await db.insert(schema.payments).values({
        memberId: args.memberId,
        invoiceId: inv.id,
        amount: inv.amount,
        method: pm.method,
        provider: pm.provider,
        receiptNumber,
      });
      await db
        .update(schema.invoices)
        .set({ status: "paid" })
        .where(eq(schema.invoices.id, inv.id));
      await logEvent(
        ctx,
        args.memberId,
        "payment_confirmed",
        `Payment confirmed automatically: $${inv.amount} for ${inv.invoiceNumber} by ${pm.method === "card" ? "card" : "bank transfer"} •••• ${pm.last4} via ${pm.provider}, straight into the company's bank account. Receipt ${receiptNumber} issued.`,
      );
      ctx.invalidateQueries();
      return { receiptNumber, amount: inv.amount };
    },
  }),

  registerPartner: defineAction({
    description:
      "Registers a partner organization's interest (school, education service, bank/credit union, employer, or other) so the Center can discuss service terms with them; saved with a confirmation and shown in Center operations.",
    request: z.object({
      orgName: z.string().min(2).max(140),
      partnerType: z.enum(["school", "education_service", "bank_credit_union", "employer", "other"]),
      contactName: z.string().min(2).max(120),
      email: z.string().email().max(160),
      phone: z.string().max(30).default(""),
      city: z.string().min(1).max(80).default("Oklahoma City"),
      servicesInterest: z.string().max(300).default(""),
      message: z.string().max(1000).default(""),
    }),
    response: z.object({ partnerId: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const inserted = await db
        .insert(schema.partners)
        .values({
          orgName: args.orgName,
          partnerType: args.partnerType,
          contactName: args.contactName,
          email: args.email,
          phone: args.phone,
          city: args.city,
          servicesInterest: args.servicesInterest,
          message: args.message,
        })
        .returning({ id: schema.partners.id });
      await logEvent(
        ctx,
        null,
        "partner_registered",
        `Partner interest registered: ${args.orgName} (${args.partnerType.replace(/_/g, " ")}) — service terms to be discussed with the Center.`,
      );
      ctx.invalidateQueries();
      return { partnerId: inserted[0]?.id ?? 0 };
    },
  }),

  adminOverview: defineAction({
    description:
      "Returns the Center's full live operations overview — every count and total operations runs on — to STAFF ONLY: the caller must present the admin code, checked server-side; a wrong or missing code is refused and returns nothing. Personal registers (names, emails, phones, children's details) are never included — aggregate counts and totals only. The public page never calls this without the code (Founder, 2026-11-13).",
    request: z.object({ adminCode: z.string().min(1).max(100) }),
    response: z.object({
      casePricing: casePricingShape,
      withdrawalPricing: withdrawalPricingShape,
      totals: z.object({
        members: z.number(),
        children: z.number(),
        applications: z.number(),
        openJobs: z.number(),
        partners: z.number(),
        monthlyRecurring: z.number(),
        plans529: z.number(),
        plans529GoalTotal: z.number(),
        plans529SavedTotal: z.number(),
        cases529: z.number(),
        cases529Completed: z.number(),
        caseFeesEarned: z.number(),
        caseFeesDue: z.number(),
        sittings: z.number(),
        sittingsCompleted: z.number(),
        sittingFeesEarned: z.number(),
        sittingFeesDue: z.number(),
        waitlist: z.number(),
        journeys: z.number(),
        doorsVisited: z.number(),
        doorsCompleted: z.number(),
        navCompletions: z.number(),
        navFeesDue: z.number(),
        navFeesEarned: z.number(),
        emailReports: z.number(),
        emailReportsSent: z.number(),
        awaitingActivation: z.number(),
      }),
    }),
    async handler(ctx, args) {
      if (!(await adminCodeMatches(ctx, args.adminCode))) {
        throw new Error("Admin access denied — that code is not correct. Operations stay locked.");
      }
      const db = ctx.db<typeof schema>();
      const memberTierRows = await db
        .select({ tier: schema.members.tier })
        .from(schema.members);
      const monthlyRecurring = memberTierRows.reduce(
        (s, m) => s + (TIERS[m.tier as TierKey] ?? TIERS.starter).monthly,
        0,
      );
      const appRows = await db.select({ id: schema.applications.id }).from(schema.applications);
      const childRows = await db.select({ id: schema.children.id }).from(schema.children);
      const jobRows = await db
        .select({ id: schema.jobListings.id })
        .from(schema.jobListings)
        .where(eq(schema.jobListings.status, "open"));
      const partnerRows = await db.select({ id: schema.partners.id }).from(schema.partners);
      const plan529Rows = await db
        .select({
          goalAmount: schema.plans529.goalAmount,
          currentSaved: schema.plans529.currentSaved,
        })
        .from(schema.plans529);
      const case529Rows = await db
        .select({
          status: schema.cases529.status,
          feeStatus: schema.cases529.feeStatus,
          feeAmount: schema.cases529.feeAmount,
        })
        .from(schema.cases529);
      const waitlistRows = await db
        .select({ id: schema.membershipWaitlist.id })
        .from(schema.membershipWaitlist);
      const sittingRows = await db
        .select({
          status: schema.withdrawalSittings.status,
          feeStatus: schema.withdrawalSittings.feeStatus,
          feeAmount: schema.withdrawalSittings.feeAmount,
        })
        .from(schema.withdrawalSittings);
      const journeyRows = await db
        .select({ id: schema.journeys.id })
        .from(schema.journeys);
      const doorRows = await db
        .select({
          status: schema.doorProgress.status,
          feeStatus: schema.doorProgress.feeStatus,
          feeAmount: schema.doorProgress.feeAmount,
        })
        .from(schema.doorProgress);
      const reportRows = await db
        .select({ status: schema.emailReports.status })
        .from(schema.emailReports);
      const awaitingRows = await db
        .select({ id: schema.members.id })
        .from(schema.members)
        .where(eq(schema.members.status, "awaiting_payment"));
      return {
        casePricing: casePricingFor(case529Rows.filter((c) => c.status === "completed").length),
        withdrawalPricing: WITHDRAWAL_PRICING,
        totals: {
          members: memberTierRows.length,
          children: childRows.length,
          applications: appRows.length,
          openJobs: jobRows.length,
          partners: partnerRows.length,
          monthlyRecurring,
          plans529: plan529Rows.length,
          plans529GoalTotal: plan529Rows.reduce((s, r) => s + r.goalAmount, 0),
          plans529SavedTotal: plan529Rows.reduce((s, r) => s + r.currentSaved, 0),
          cases529: case529Rows.length,
          cases529Completed: case529Rows.filter((c) => c.status === "completed").length,
          caseFeesEarned: case529Rows
            .filter((c) => c.feeStatus === "paid")
            .reduce((s, c) => s + c.feeAmount, 0),
          caseFeesDue: case529Rows
            .filter((c) => c.status === "completed" && c.feeStatus === "due_on_success")
            .reduce((s, c) => s + c.feeAmount, 0),
          sittings: sittingRows.length,
          sittingsCompleted: sittingRows.filter((s) => s.status === "completed").length,
          sittingFeesEarned: sittingRows
            .filter((s) => s.feeStatus === "paid")
            .reduce((s, r) => s + r.feeAmount, 0),
          sittingFeesDue: sittingRows
            .filter((s) => s.status === "completed" && s.feeStatus === "due_on_success")
            .reduce((s, r) => s + r.feeAmount, 0),
          waitlist: waitlistRows.length,
          journeys: journeyRows.length,
          doorsVisited: doorRows.filter((d) => d.status === "visited" || d.status === "completed").length,
          doorsCompleted: doorRows.filter((d) => d.status === "completed").length,
          navCompletions: doorRows.filter(
            (d) => d.status === "completed" && d.feeAmount > 0,
          ).length,
          navFeesDue: doorRows
            .filter((d) => d.feeStatus === "due")
            .reduce((s, d) => s + d.feeAmount, 0),
          navFeesEarned: doorRows
            .filter((d) => d.feeStatus === "paid")
            .reduce((s, d) => s + d.feeAmount, 0),
          emailReports: reportRows.length,
          emailReportsSent: reportRows.filter((r) => r.status === "sent").length,
          awaitingActivation: awaitingRows.length,
        },
      };
    },
  }),

  updateApplication: defineAction({
    description:
      "Updates a financial-service application's status or records the partner institution's decision (admin operations). Staff only: the caller must present the admin code, checked server-side (hardening, 2026-11-13).",
    request: z.object({
      adminCode: z.string().min(1).max(100),
      applicationId: z.number().int().positive(),
      status: z.enum(["received", "in_review", "with_partner", "decided"]),
      decision: z.string().max(500).default(""),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      if (!(await adminCodeMatches(ctx, args.adminCode))) {
        throw new Error("Admin access denied — that code is not correct. Operations stay locked.");
      }
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.applications)
        .set({ status: args.status, decision: args.decision, updatedAt: new Date() })
        .where(eq(schema.applications.id, args.applicationId));
      const rows = await db
        .select()
        .from(schema.applications)
        .where(eq(schema.applications.id, args.applicationId))
        .limit(1);
      const app = rows[0];
      if (app) {
        await logEvent(
          ctx,
          app.memberId,
          "application_update",
          `Your ${app.service === "term_advance" ? "Term Advance" : "Family Credit Support"} application is now “${args.status.replace("_", " ")}”${args.decision ? `: ${args.decision}` : ""}.`,
        );
      }
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),
};

// The callable contract type the client (src/client/api.ts) types against —
// same shape the space SDK's typed client exposed: call args are the zod
// INPUT of each request schema, results are the zod OUTPUT of each
// response schema.
export type Actions = {
  [K in keyof typeof ActionDefs]: (
    args: z.input<(typeof ActionDefs)[K]["request"]>,
  ) => Promise<z.output<(typeof ActionDefs)[K]["response"]>>;
};
