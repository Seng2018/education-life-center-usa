// Drizzle schema for Education Life Center USA.
//
// Members subscribe once; the system issues a member number, a digital
// member card, tier billing invoices, and a referral code automatically.
// Services on the platform: 1 Membership & the Member Card, 5 Term Advance,
// 6 Job Promotion, 7 Family Credit Support. Financial services are
// applications routed to partner institutions — the Center never lends.
//
// THE DOOR (Founder decision, 2026-11-11): the 529 case door comes
// FIRST, the membership opens later. A parent who is not a member can buy
// a one-time 529 case — guided setup of one child's Oklahoma 529 account
// for a flat fee paid only on success. Cases live in `cases_529`.
//
// CASE PRICING (Founder decision, 2026-11-11): $99 is the FOUNDING price
// for the first 50 completed cases, then the standard fee is $149. Each
// case stores its price in `fee_amount` at the moment it starts — priced
// from the completed-case count at that moment — so existing cases keep
// the price they started with when the founding price ends.
//
// MEMBERSHIP WAITLIST (Founder decision, 2026-11-11): until the membership
// opens, the subscribe form is parked as a simple waitlist — name and
// contact saved in `membership_waitlist`, nothing activated: no member
// number, no member card, no invoice, no referral code. The membership
// machinery (members, member_cards, invoices) stays in place and takes
// over when the Center opens the membership.
//
// GUIDED WITHDRAWAL (Founder decision, 2026-11-12): the second completed
// service, mirroring the case door at the other end of the journey. When
// a family needs to take money OUT of a child's 529, they book a guided
// withdrawal sitting in `withdrawal_sittings`: the account owner does
// every step themselves on the state plan's site while the Center guides
// beside them — expense checked, destination chosen (straight to the
// school is cleanest), same-calendar-year rule kept, 1099-Q paperwork
// explained. The fee is one simple price — $199 flat per completed
// sitting (Founder's fee ruling, 2026-11-12) — stored in `fee_amount`
// when the sitting is
// booked, due only when the sitting completes (the withdrawal correctly
// requested and on its way), and never a percentage of the withdrawal.
// The Center never touches 529 money, never holds the owner's password,
// and gives general education only — not investment advice and not tax
// preparation.

import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const members = sqliteTable("members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  memberNumber: text("member_number").notNull().unique(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  city: text("city").notNull().default("Oklahoma City"),
  state: text("state").notNull().default("OK"),
  tier: text("tier", { enum: ["starter", "family", "family_plus"] }).notNull(),
  // Participant pipeline (Founder, 2026-11-13): an application starts as
  // "awaiting_payment" — the membership activates automatically only
  // when operations confirms the fee arrived at the Center's bank
  // account against the invoice's payment reference. "lapsed" = the
  // membership is not current (its electronic card lapses with it).
  status: text("status", { enum: ["awaiting_payment", "active", "paused", "lapsed"] })
    .notNull()
    .default("active"),
  referralCode: text("referral_code").notNull().unique(),
  referredByCode: text("referred_by_code"),
  // SHA-256 hash of the member's personal access key — the credential
  // that gates the dashboard and every member-scoped action (security
  // correction, 2026-11-12). The plain key is shown to the member once,
  // at subscribe; only the hash is ever stored. Null = no key issued
  // (no dashboard access until the Center issues one).
  accessKeyHash: text("access_key_hash"),
  freeYearsEarned: integer("free_years_earned").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const children = sqliteTable("children", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  memberId: integer("member_id")
    .notNull()
    .references(() => members.id),
  name: text("name").notNull(),
  birthYear: integer("birth_year").notNull(),
  schoolLevel: text("school_level").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const memberCards = sqliteTable("member_cards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  memberId: integer("member_id")
    .notNull()
    .unique()
    .references(() => members.id),
  cardNumber: text("card_number").notNull().unique(),
  // The electronic card is issued automatically on activation. It is
  // usable at partner stores while the membership is current; when the
  // membership is not current the card reads "lapsed" in verification.
  status: text("status", { enum: ["active", "suspended", "lapsed"] })
    .notNull()
    .default("active"),
  issuedAt: integer("issued_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const applications = sqliteTable("applications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  memberId: integer("member_id")
    .notNull()
    .references(() => members.id),
  service: text("service", {
    enum: ["term_advance", "job_promotion", "family_credit"],
  }).notNull(),
  amount: real("amount"),
  purpose: text("purpose").notNull().default(""),
  detail: text("detail").notNull().default(""),
  partner: text("partner").notNull().default(""),
  status: text("status", {
    enum: ["received", "in_review", "with_partner", "decided"],
  })
    .notNull()
    .default("received"),
  decision: text("decision").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const invoices = sqliteTable("invoices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  memberId: integer("member_id")
    .notNull()
    .references(() => members.id),
  invoiceNumber: text("invoice_number").notNull().unique(),
  // Unique bank payment reference (Founder, 2026-11-13): the participant
  // pays the fee into the Center's bank account quoting this reference;
  // operations confirms by reference and the membership activates
  // automatically. Empty for invoices created before the pipeline.
  paymentReference: text("payment_reference").notNull().default(""),
  periodLabel: text("period_label").notNull(),
  amount: real("amount").notNull(),
  status: text("status", {
    enum: ["scheduled", "due_at_launch", "awaiting_bank_payment", "covered_by_referral_reward", "paid"],
  })
    .notNull()
    .default("due_at_launch"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const jobListings = sqliteTable("job_listings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  employerName: text("employer_name").notNull(),
  title: text("title").notNull(),
  location: text("location").notNull().default("Oklahoma City, OK"),
  payRange: text("pay_range").notNull().default(""),
  description: text("description").notNull().default(""),
  contactEmail: text("contact_email").notNull(),
  // Researched-listing fields (Founder, 2026-11-13): the official
  // application URL members apply through, full/part-time as published,
  // the one-line minimum requirements, any apply-by deadline, and the
  // date the listing was verified open on the employer's official site.
  // Empty for openings employers post directly on the board.
  applyUrl: text("apply_url").notNull().default(""),
  employmentType: text("employment_type").notNull().default(""),
  requirements: text("requirements").notNull().default(""),
  deadline: text("deadline").notNull().default(""),
  verifiedDate: text("verified_date").notNull().default(""),
  status: text("status", { enum: ["open", "closed"] }).notNull().default("open"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const jobApplications = sqliteTable("job_applications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  memberId: integer("member_id")
    .notNull()
    .references(() => members.id),
  listingId: integer("listing_id")
    .notNull()
    .references(() => jobListings.id),
  note: text("note").notNull().default(""),
  status: text("status", {
    enum: ["sent_to_employer", "interview", "placed", "closed"],
  })
    .notNull()
    .default("sent_to_employer"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const automationEvents = sqliteTable("automation_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  memberId: integer("member_id").references(() => members.id),
  kind: text("kind").notNull(),
  message: text("message").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Partner organizations: schools and education-supporting services, partner
// banks / credit unions, and employers. Service terms are discussed with
// each partner; registering interest here starts that conversation — it is
// not a contract and implies no government affiliation.
export const partners = sqliteTable("partners", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orgName: text("org_name").notNull(),
  partnerType: text("partner_type", {
    enum: ["school", "education_service", "bank_credit_union", "employer", "other"],
  }).notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull().default(""),
  city: text("city").notNull().default("Oklahoma City"),
  servicesInterest: text("services_interest").notNull().default(""),
  message: text("message").notNull().default(""),
  status: text("status", { enum: ["interest_registered", "in_discussion", "active_partner"] })
    .notNull()
    .default("interest_registered"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// A member's fintech payment method. Only the method type, provider, and
// last four digits are stored here — full card or bank details are entered
// on the payment provider's own secure page and never touch this system.
// Payments are processed by the provider straight into the company's bank
// account; the Center never holds members' service money.
export const paymentMethods = sqliteTable("payment_methods", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  memberId: integer("member_id")
    .notNull()
    .unique()
    .references(() => members.id),
  method: text("method", { enum: ["card", "bank_transfer"] }).notNull(),
  provider: text("provider").notNull().default("Fintech payment provider"),
  last4: text("last4").notNull(),
  autoRenew: integer("auto_renew").notNull().default(1),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// 529 Access — a guidance and tracking feature inside the membership.
// The Center never creates its own 529 plan and never holds 529 money:
// only a state can run a 529 plan, and the parent's money flows directly
// from the parent to Oklahoma's state plans. This table stores only the
// family's own savings goal, the plan they chose, what they report they
// have saved, and whether they want contribution reminders — the Center
// guides, tracks, and reminds; it does not advise on investments.
export const plans529 = sqliteTable("plans_529", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  memberId: integer("member_id")
    .notNull()
    .references(() => members.id),
  childName: text("child_name").notNull(),
  planChoice: text("plan_choice", {
    enum: ["oklahoma_529", "oklahomadream_529", "undecided"],
  })
    .notNull()
    .default("undecided"),
  goalAmount: real("goal_amount").notNull().default(0),
  monthlyContribution: real("monthly_contribution").notNull().default(0),
  currentSaved: real("current_saved").notNull().default(0),
  targetYear: integer("target_year").notNull().default(2040),
  status: text("status", {
    enum: ["planning", "guidance_requested", "account_opened", "tracking"],
  })
    .notNull()
    .default("planning"),
  remindersOn: integer("reminders_on").notNull().default(1),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// 529 cases — the front door. A case is ONE non-member parent's guided
// setup for ONE child's Oklahoma 529 account: goal calculated, plan
// explained (general education only), account opened by the parent on the
// state plan's site, first contribution arranged. The fee is a flat fee
// for guidance, due only when the case completes successfully — never a
// percentage of the account. Pricing (Founder, 2026-11-11): $99 founding
// price for the first 50 completed cases, then $149 standard; the price
// is locked into `fee_amount` when the case starts, based on how many
// cases have completed at that moment. Advisor-sold (OklahomaDream 529)
// cases carry no success fee: the Center gives general guidance only
// there, and any advisor fee belongs to the advisor. The Center never
// touches 529 money.
export const cases529 = sqliteTable("cases_529", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caseNumber: text("case_number").notNull().unique(),
  parentName: text("parent_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull().default(""),
  city: text("city").notNull().default("Oklahoma City"),
  childName: text("child_name").notNull(),
  planChoice: text("plan_choice", {
    enum: ["oklahoma_529", "oklahomadream_529", "undecided"],
  })
    .notNull()
    .default("undecided"),
  goalAmount: real("goal_amount").notNull().default(0),
  monthlyContribution: real("monthly_contribution").notNull().default(0),
  status: text("status", {
    enum: ["requested", "in_progress", "completed"],
  })
    .notNull()
    .default("requested"),
  feeStatus: text("fee_status", {
    enum: ["not_due", "due_on_success", "paid"],
  })
    .notNull()
    .default("due_on_success"),
  feeAmount: real("fee_amount").notNull().default(99),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Membership waitlist — the parked form while the membership is not open
// yet. One row per person (email is unique; re-joining updates the row).
// Joining saves the name and contact only — it activates nothing.
export const membershipWaitlist = sqliteTable("membership_waitlist", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull().default(""),
  city: text("city").notNull().default("Oklahoma City"),
  interestedTier: text("interested_tier", {
    enum: ["starter", "family", "family_plus"],
  }),
  note: text("note").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Guided withdrawal sittings — the completed service at the other end
// of the 529 journey (Founder, 2026-11-12). One sitting = one guided
// withdrawal for one child: the owner requests the withdrawal themselves
// on the state plan's site; the Center guides the mechanics and the
// paperwork. feeAmount is the flat guidance fee locked in at booking —
// $199 — due only when the sitting
// completes; never a percentage of the amount withdrawn. The Center stores only
// what the family books: who, which child, which plan, what the money
// is for, roughly how much, and when it is due. It never stores account
// credentials and never sees or holds the withdrawn money.
export const withdrawalSittings = sqliteTable("withdrawal_sittings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sittingNumber: text("sitting_number").notNull().unique(),
  parentName: text("parent_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull().default(""),
  city: text("city").notNull().default("Oklahoma City"),
  childName: text("child_name").notNull(),
  planChoice: text("plan_choice", {
    enum: ["oklahoma_529", "oklahomadream_529", "undecided"],
  })
    .notNull()
    .default("oklahoma_529"),
  purpose: text("purpose", {
    enum: ["college", "k12_tuition", "student_loan", "apprenticeship", "roth_rollover", "other_qualified"],
  })
    .notNull()
    .default("college"),
  isMember: integer("is_member").notNull().default(0),
  plannedAmount: real("planned_amount").notNull().default(0),
  targetDate: text("target_date").notNull().default(""),
  status: text("status", {
    enum: ["requested", "in_progress", "completed"],
  })
    .notNull()
    .default("requested"),
  feeStatus: text("fee_status", {
    enum: ["not_due", "due_on_success", "paid"],
  })
    .notNull()
    .default("due_on_success"),
  feeAmount: real("fee_amount").notNull().default(199),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ---------------------------------------------------------------------------
// INTERACTIVE JOURNEYS (Founder, 2026-11-12): the site is interactive with
// every visitor. A family tracks its own journey under one journey number:
// for every door (the 529 case door, Guided Withdrawal, and the money-map
// doors — guided and pointer tiers) the family can click out to the
// OFFICIAL website and register themselves. The Center never receives or
// stores any official-site credential (no FSA ID, no plan password).
// Progress per door: not_started → visited (the click-out, timestamped)
// → completed (SELF-REPORTED by the family — official sites do not report
// back to the Center, and the site says so plainly).
//
// SELF-SERVICE SUCCESS FEE (Founder ruling, 2026-11-12): when a family
// completes a GUIDED-tier door entirely by self-service and reports the
// completion, a flat $25 success fee falls due — it buys the Center's
// navigation service (matched door list, step guidance, AI help, journey
// tracking, email reports, the completion record on file), never a
// government form, application, or benefit, which are always free.
// Pointer-tier doors carry NO fee. A self-service completion does NOT
// consume a founding guided-case spot; navigation completions are
// counted separately from guided case/sitting completions.
//
// EMAIL REPORTS: every journey event (door started, click-out, reported
// completion) generates two report rows in `email_reports` — a summary
// for the family (showing their journey/case numbers and door statuses)
// and an activity report for the Center. Delivery runs through the
// Center's own agent (Gmail) via a spawned task; a row's status is
// "recorded" until the sending task confirms it "sent" through the
// confirmEmailReportsSent action.
export const journeys = sqliteTable("journeys", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  journeyNumber: text("journey_number").notNull().unique(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const doorProgress = sqliteTable("door_progress", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  journeyId: integer("journey_id")
    .notNull()
    .references(() => journeys.id),
  doorId: text("door_id").notNull(),
  tier: text("tier", { enum: ["guided", "pointer"] }).notNull().default("guided"),
  status: text("status", {
    enum: ["not_started", "visited", "completed"],
  })
    .notNull()
    .default("not_started"),
  visitedAt: integer("visited_at", { mode: "timestamp_ms" }),
  completedDate: text("completed_date").notNull().default(""),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  // Self-service navigation success fee: $25 on a reported completion of
  // a guided-tier door; 0 and fee_status "none" for pointer doors.
  feeAmount: real("fee_amount").notNull().default(0),
  feeStatus: text("fee_status", { enum: ["none", "due", "paid"] })
    .notNull()
    .default("none"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const emailReports = sqliteTable("email_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  journeyId: integer("journey_id").references(() => journeys.id),
  kind: text("kind", { enum: ["family_summary", "center_activity"] }).notNull(),
  event: text("event").notNull().default(""),
  recipient: text("recipient").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: text("status", { enum: ["recorded", "sent"] })
    .notNull()
    .default("recorded"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const payments = sqliteTable("payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  memberId: integer("member_id")
    .notNull()
    .references(() => members.id),
  invoiceId: integer("invoice_id")
    .notNull()
    .references(() => invoices.id),
  amount: real("amount").notNull(),
  method: text("method", { enum: ["card", "bank_transfer"] }).notNull(),
  provider: text("provider").notNull(),
  receiptNumber: text("receipt_number").notNull().unique(),
  status: text("status", { enum: ["confirmed"] }).notNull().default("confirmed"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});
