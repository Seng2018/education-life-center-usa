// Education Life Center USA — the membership system.
//
// STARTING SERVICE SET (Founder decision, 2026-11-11): Service 1
// Membership & the Member Card, Service 6 Job Promotion, Service 7 Family
// Credit Support, plus 529 Access — a built-in feature of the membership
// (inside Service 1): the Center guides parents to open an account in
// Oklahoma's own state 529 plans, then tracks their goal and reminds them
// to contribute. Only a state can run a 529 plan — the Center never
// creates one, never holds 529 money, and gives general education only,
// never personal investment advice.
//
// Service 5 Term Advance is PARKED — built into the system, presented as
// "coming later", taking no applications until the Center switches it on.
//
// THE DOOR (Founder decision, 2026-11-11): BOTH, in sequence — the case
// door FIRST, membership later. The page leads with the one-time 529
// case service: a parent who is NOT a member gets guided setup of one
// child's Oklahoma 529 account (goal calculated, plan explained, account
// opened, first contribution arranged) for a flat fee paid only on
// success. A case = one child's account opened; unfinished cases pay
// nothing. The fee is for guidance only, never a percentage of the
// account; advisor-sold (OklahomaDream 529) guidance carries no success
// fee — the Center gives general guidance only there and any advisor fee
// belongs to the advisor. The membership (Service 1 + Job Promotion +
// Family Credit Support) stands behind the case door as the later,
// ongoing relationship — presented as "opens later", not the front door.
//
// CASE PRICING (Founder decision, 2026-11-11): $99 is the founding price
// for the first 50 completed cases. The page reads
// the live pricing from getPublicStats (casePricing: the pricing rule
// and the fee the next case will carry — no live counts on the public
// action since 2026-11-13) and each case keeps
// the feeAmount it was priced with at start — confirmations and the
// operations pipeline show that stored per-case fee, never a hard-coded
// $99.
//
// GUIDED WITHDRAWAL (Founder, 2026-11-12): the second completed service,
// at the other end of the journey. A family books a guided withdrawal
// sitting (#withdrawal, directly after the case door): the account
// owner requests the withdrawal themselves on the state plan's site
// while the Center guides the mechanics and paperwork — expense
// checked, destination chosen, same-calendar-year rule kept, 1099-Q
// explained. ONE simple price (Founder's fee ruling, 2026-11-12) —
// read live from getPublicStats (withdrawalPricing), due only when the
// sitting completes, never a percentage of the withdrawal. The Center
// never touches 529 money, never holds the owner's password, and gives
// general education only — not investment advice, not tax preparation.
//
// The Center never lends: Family Credit Support (and Term Advance, when
// it opens) are applications the system routes to partner banks and
// credit unions, which decide.
//
// One page, four working parts:
//   1. Membership waitlist — until the membership opens, the subscribe form
//      is parked as a waitlist: name and contact are saved with a
//      confirmation and a place in line, and NOTHING is activated (no
//      member number, card, invoice, or referral code). The subscribe
//      automation stays built in and refused server-side until opening.
//   2. Member dashboard — card, children, 529 Access goals, service
//      applications, invoices, referral progress, and the automation log.
//   3. Job Promotion board — employers post openings; members apply and the
//      system forwards the application automatically.
//   4. Admin — Center operations, STAFF ONLY (Founder, 2026-11-13): the
//      live numbers the Center runs on are NOT public. At opening the
//      Center has no activity yet and public zeros would damage
//      credibility, so the operations view sits behind the Admin tab's
//      code prompt; the server refuses the numbers without the admin
//      code, and nothing operational renders for a public visitor.
//      Published STATE statistics (Oklahoma / US 529 totals) are public
//      facts and stay on the public page.

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaTopScrim } from "./SafeAreaTopScrim";
import { api, type ApiRequest, type ApiResponse } from "./api";
import { LangProvider, useLang, LANG_OPTIONS, type Lang } from "./i18n";
import { qrMatrix } from "./qr";
import campusImg from "./assets/campus-students.jpg";
import familyImg from "./assets/family-backpack.jpg";
import okcImg from "./assets/okc-skyline.jpg";
import logoImg from "./assets/logo-elc-usa.webp";
import companionImg from "./assets/ai-companion-walk.webp";
import companionVideo from "./assets/ai-companion-walk.mp4";

type Dashboard = ApiResponse<typeof api, "getDashboard">;
type Member = Dashboard["member"];
type Listing = ApiResponse<typeof api, "listJobs">["listings"][number];
type CasePricing = ApiResponse<typeof api, "getPublicStats">["casePricing"];
type WithdrawalPricing = ApiResponse<typeof api, "getPublicStats">["withdrawalPricing"];

// Fallback used only while live pricing is still loading — matches the
// founding price a brand-new Center with zero completed cases charges.
// Public pricing carries no operational counts (Founder, 2026-11-13).
const DEFAULT_CASE_PRICING: CasePricing = {
  foundingLimit: 50,
  foundingFee: 99,
  standardFee: 99,
  nextCaseFee: 99,
  isFoundingPrice: true,
};

// The guided withdrawal sitting fee (Founder's fee ruling, 2026-11-12)
// is read live from getPublicStats; this is only a loading placeholder.
const DEFAULT_WITHDRAWAL_PRICING: WithdrawalPricing = { fee: 0 };

// FORMATION MODE (Founder, 2026-11-13): the site publishes in formation
// mode until Education Life Center USA, LLC is filed and its bank
// account exists. While true, the $99 case door and the guided
// withdrawal sittings show an "opening soon — in formation" notice
// instead of their intake forms (the server refuses the intakes too),
// there is no payment step anywhere on the page, and the membership
// waitlist is the live intake. The members-only jobs lock and the
// admin gate are unchanged. Flip to false — here and FORMATION_MODE
// in server/src/actions.ts — when the LLC is filed and the company
// bank account is open; the forms below then take over again.
const FORMATION_MODE = true;

// ONE membership (Founder ruling, 2026-11-19): $99 one time per family
// for the whole education life — no tiers, no monthly billing, no
// renewal. The single entry keeps the key "family" so the waitlist and
// staff application forms submit the same value as before.
const TIER_OPTIONS = [
  {
    key: "family",
    label: "Membership",
    price: 99,
    blurb: "One membership for the whole family — children covered free. The Member Card for the whole membership, every guided door on this website, the Job Promotion board, Family Credit Support, 529 Access tracking and reminders, and the AI family assistant's guidance in all six languages — from joining until the member gets a job.",
  },
] as const;

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-base text-[var(--text)] placeholder:text-[var(--dim)]";
const labelCls = "block text-sm font-medium text-[var(--text)] mb-1";
const btnPrimary =
  "inline-flex items-center justify-center rounded-lg bg-[var(--accent)] px-5 py-2.5 text-base font-semibold text-white disabled:opacity-50";
const btnGold =
  "inline-flex items-center justify-center rounded-lg bg-[var(--gold)] px-5 py-2.5 text-base font-semibold text-[#16294d] disabled:opacity-50";
const btnGhost =
  "inline-flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text)] disabled:opacity-50";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// The signed-in member's personal access key, kept with their email in
// this browser only. Member-scoped actions require it server-side.
function storedAccessKey(): string {
  try {
    return window.localStorage.getItem("elc-member-key") ?? "";
  } catch {
    return "";
  }
}

function statusLabel(s: string): string {
  return s.replace(/_/g, " ");
}

function SectionTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="mb-5">
      <h2 className="font-display text-2xl font-semibold text-[var(--text)] sm:text-3xl">
        {children}
      </h2>
      {sub ? <p className="mt-1 max-w-2xl text-base text-[var(--dim)]">{sub}</p> : null}
    </div>
  );
}

// The official logo — Founder-approved final (shield & book, graduation cap
// in frame, name in the middle). One imported asset reused everywhere so the
// mark stays identical across the site. The artwork sits on white, so every
// placement keeps it on a white ground with rounded corners.
function LogoMark({
  className = "h-12 w-12",
  decorative = false,
}: {
  className?: string;
  decorative?: boolean;
}) {
  return (
    <img
      src={logoImg}
      alt={decorative ? "" : "Education Life Center USA logo — shield with graduation cap, name, and open book"}
      className={`shrink-0 rounded-xl bg-white object-contain p-1 shadow-sm ring-1 ring-black/10 ${className}`}
      loading="lazy"
    />
  );
}

function SectionWithLogo({
  children,
  sub,
  logoClassName = "h-14 w-14 sm:h-16 sm:w-16",
}: {
  children: ReactNode;
  sub?: string;
  logoClassName?: string;
}) {
  return (
    <div className="mb-5 flex items-start gap-3 sm:gap-4">
      <LogoMark className={logoClassName} />
      <div className="min-w-0">
        <h2 className="font-display text-2xl font-semibold text-[var(--text)] sm:text-3xl">
          {children}
        </h2>
        {sub ? <p className="mt-1 max-w-2xl text-base text-[var(--dim)]">{sub}</p> : null}
      </div>
    </div>
  );
}

// Draft-style disclosure: the key point stays on the page; the full
// explanation sits behind a tap. Used across the page so the first read
// is short — points first, details on demand.
function Details({
  summary,
  children,
  defaultOpen = false,
}: {
  summary?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const { t } = useLang();
  const label = summary ?? t.common.details;
  return (
    <details open={defaultOpen || undefined} className="group mt-3">
      <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text)] [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="text-[var(--gold)] transition-transform group-open:rotate-90">▸</span>
        {label}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

const SERVICES = [
  {
    no: "Service 1",
    title: "Membership & the Member Card — with 529 Access",
    hook: "Join once, and one card carries your whole family's education life — every child, every goal, one place that looks after it all.",
    text: "The ongoing relationship, opening later: join once, participate every year, covered through the whole education life. When the membership opens, your digital Member Card is issued by the system the moment you subscribe, and carries your member number everywhere in the Center. Until then, the membership form below is a waitlist — leave your name and contact and be invited at opening. 529 Access stands inside this membership — a savings goal for each child, tracking on your dashboard, and reminders to keep contributing, because starting is easy and keeping going is where families drift. You do not have to wait for the membership to start saving: the case door above opens your child's account today. The Center never creates a 529 and never touches 529 money: your money goes from you straight to the state plan, and the guidance is general education, never personal investment advice.",
    points: ["Instant digital card", "One membership for the whole family", "Children covered free", "529 Access — starts today via the case door"],
  },
  {
    no: "Service 6",
    title: "Job Promotion",
    hook: "Graduation is not the finish line — the first job is. This board carries young people across it.",
    text: "The board that connects people: employers post openings, members and graduates apply, and the system forwards each application to the employer automatically. Education ends at the goal line — a first job.",
    points: ["Employers post free", "One-tap member applications", "Forwarded automatically"],
  },
  {
    no: "Service 7",
    title: "Family Credit Support",
    hook: "When a family need can't wait for savings to catch up, one honest application reaches the banks and credit unions for you.",
    text: "For bigger family needs — a car to reach work, home repairs, education costs — members apply once and the system routes the application to partner banks and credit unions. The Center supports the application; it never lends directly.",
    points: ["One application, partner review", "The Center never lends itself", "Decision recorded on your dashboard"],
  },
];

// Parked at start (Founder decision, 2026-11-11): built into the system,
// presented as coming later, taking no applications until switched on.
const PARKED_SERVICES = [
  {
    no: "Service 5",
    title: "Term Advance",
    text: "When a term's costs land before payday does, members will apply inside their dashboard; the system will check the application and route it to a partner bank or credit union, which reviews it and makes the decision. Term Advance is built into this system but stays switched off at the start — it opens later, on the Center's word.",
    points: ["Coming later", "Not offered at start", "Applications open when the Center switches it on"],
  },
];

// Regional-indicator flag emoji for a 2-letter country code ("US" → 🇺🇸).
// Returns "" for anything that is not exactly two A–Z letters, so an
// unknown code ("XX") simply shows no flag.
function countryFlag(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return "";
  return String.fromCodePoint(
    ...[...code].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65),
  );
}

export function App() {
  return (
    <LangProvider>
      <AppInner />
    </LangProvider>
  );
}

function AppInner() {
  const { lang, setLang, t } = useLang();
  const queryClient = useQueryClient();
  // Signed-in state is the member's own email address — dashboards are
  // fetched by email, never by guessable numeric ID (security
  // correction, 2026-11-12).
  const [memberEmail, setMemberEmail] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem("elc-member-email");
    } catch {
      return null;
    }
  });
  const [memberKey, setMemberKey] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem("elc-member-key");
    } catch {
      return null;
    }
  });
  const [justJoined, setJustJoined] = useState(false);

  useEffect(() => {
    try {
      if (memberEmail) window.localStorage.setItem("elc-member-email", memberEmail);
      else window.localStorage.removeItem("elc-member-email");
      if (memberKey) window.localStorage.setItem("elc-member-key", memberKey);
      else window.localStorage.removeItem("elc-member-key");
      window.localStorage.removeItem("elc-member-id");
    } catch {
      /* storage unavailable in this frame — session state still works */
    }
  }, [memberEmail, memberKey]);

  const stats = useQuery({
    queryKey: ["public-stats"],
    queryFn: () => api.getPublicStats({}),
  });

  // Visitor counter: record one visit per browser session (fire-and-
  // forget — a failed call changes nothing on the page). The totals are
  // shown only in the Admin area (Founder, 2026-11-20).
  useEffect(() => {
    try {
      if (!window.sessionStorage.getItem("elc-visit-tracked")) {
        window.sessionStorage.setItem("elc-visit-tracked", "1");
        void api
          .trackVisit({ path: window.location.pathname })
          .catch(() => {});
      }
    } catch {
      /* storage unavailable in this frame — skip tracking this session */
    }
  }, []);

  const dashboard = useQuery({
    queryKey: ["dashboard", memberEmail],
    queryFn: () =>
      api.getDashboard({ email: memberEmail ?? "", accessKey: memberKey ?? "" }),
    enabled: memberEmail != null && memberKey != null,
  });
  const memberId = dashboard.data?.member.id ?? null;

  const signOut = () => {
    setMemberEmail(null);
    setMemberKey(null);
    setJustJoined(false);
    queryClient.removeQueries({ queryKey: ["dashboard"] });
  };

  const casePricing: CasePricing = stats.data?.casePricing ?? DEFAULT_CASE_PRICING;
  const nextCaseFee = casePricing.nextCaseFee;
  const withdrawalPricing: WithdrawalPricing =
    stats.data?.withdrawalPricing ?? DEFAULT_WITHDRAWAL_PRICING;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <SafeAreaTopScrim backgroundColor="var(--bg)" />

      {/* ---------- Top navigation ---------- */}
      {/* Dark green header in two rows (Founder, 2026-11-13): row one
          carries the logo and site title on the left with the language
          selector on the right, on the same line as the logo; row two,
          below the logo line, carries the navigation tabs on their own
          line so the title never has to share its row with the tabs. */}
      <div className="sticky top-0 z-40 bg-[#14532d] text-white shadow-md">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex items-center gap-3 py-2.5">
            <a href="#top" className="flex min-w-0 items-center gap-3" aria-label={t.nav.backTop}>
              <LogoMark className="h-11 w-11" decorative />
              <span className="min-w-0">
                <span className="font-display block text-base font-semibold leading-tight text-white sm:text-lg">
                  Education Life Center USA
                </span>
                <span className="block truncate text-xs text-white/70">{t.hero.location}</span>
              </span>
            </a>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <label className="sr-only" htmlFor="lang-select">{t.nav.language}</label>
              <select
                id="lang-select"
                aria-label="Language / Idioma / Ngôn ngữ / 语言"
                className="max-w-[6.75rem] rounded-lg border border-white/30 bg-white/10 px-1.5 py-2 text-xs font-medium text-white sm:max-w-none sm:px-2 sm:text-sm [&>option]:text-[#232a35]"
                value={lang}
                onChange={(e) => setLang(e.target.value as Lang)}
              >
                {LANG_OPTIONS.map((o) => (
                  <option key={o.code} value={o.code}>{o.label}</option>
                ))}
              </select>
              <a href={memberEmail == null ? "#case529" : "#dashboard"} className="hidden shrink-0 items-center justify-center rounded-lg bg-[var(--gold)] px-4 py-2 text-sm font-semibold text-[#16294d] min-[480px]:inline-flex">
                {memberEmail == null ? (FORMATION_MODE ? t.formation.caseDoorSoon : t.nav.startCase) : t.nav.dashboard}
              </a>
            </div>
          </div>
          <nav aria-label="Main" className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/15 py-2 text-base font-medium text-white/90 md:text-lg">
            <a href="#glance" className="whitespace-nowrap hover:text-white hover:underline">{t.nav.glance}</a>
            <a href="#case529" className="whitespace-nowrap hover:text-white hover:underline">{t.nav.caseLink} — ${nextCaseFee}</a>
            <a href="#withdrawal" className="whitespace-nowrap hover:text-white hover:underline">{t.nav.withdrawal}</a>
            <a href="#parents" className="whitespace-nowrap hover:text-white hover:underline">{t.nav.parents}</a>
            <a href="#services" className="whitespace-nowrap hover:text-white hover:underline">{t.nav.services}</a>
            <a href="#access529" className="whitespace-nowrap hover:text-white hover:underline">{t.nav.access}</a>
            <a href="#plans" className="whitespace-nowrap hover:text-white hover:underline">{t.nav.plans}</a>
            <a href="#jobs" className="whitespace-nowrap hover:text-white hover:underline">{t.nav.jobs}</a>
            <a href="#partners" className="whitespace-nowrap hover:text-white hover:underline">{t.nav.partners}</a>
            <a href="#doors" className="whitespace-nowrap hover:text-white hover:underline">{t.nav.doors}</a>
            <a href="#intl" className="whitespace-nowrap hover:text-white hover:underline">{t.nav.intl}</a>
            <a href="#journey" className="whitespace-nowrap hover:text-white hover:underline">{t.nav.journey}</a>
          </nav>
        </div>
      </div>

      {/* ---------- Formation banner (Founder, 2026-11-13) ---------- */}
      {FORMATION_MODE ? (
        <div className="border-b-2 border-[var(--gold)] bg-[var(--gold-soft)]">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-x-5">
            <p className="min-w-0 flex-1 text-base">
              <strong>{t.formation.bannerTitle}.</strong> {t.formation.bannerBody}
            </p>
            <a href="#subscribe" className={`${btnGold} shrink-0 self-start sm:self-auto`}>
              {t.formation.waitlistCta}
            </a>
          </div>
        </div>
      ) : null}

      {/* ---------- Hero ---------- */}
      <header id="top" className="relative overflow-hidden bg-[#16294d] text-white">
        <img
          src={campusImg}
          alt="Students walking together on a college campus"
          className="absolute inset-0 h-full w-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-[#16294d]/55" />
        <div className="relative mx-auto max-w-6xl px-4 pb-12 pt-10 sm:pt-14">
          <div className="flex items-center gap-4 sm:gap-5">
            <LogoMark className="h-24 w-24 p-1.5 sm:h-32 sm:w-32" />
            <div className="min-w-0">
              <p className="font-display text-xl font-semibold leading-tight sm:text-2xl">
                Education Life Center USA
              </p>
              <p className="mt-1 text-sm font-semibold uppercase tracking-widest text-[var(--gold)]">
                {t.hero.location}
              </p>
              <p className="mt-1 hidden text-sm text-white/75 sm:block">
                {t.hero.tagline}
              </p>
            </div>
          </div>
          <h1 className="font-display mt-6 max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
            {t.hero.titleA} ${nextCaseFee}{t.hero.titlePaid}
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white/85">
            {FORMATION_MODE ? t.formation.heroBodyA : t.hero.bodyA} ${nextCaseFee}{t.hero.bodyPaid}{" "}
            {FORMATION_MODE ? (
              <>{t.formation.heroFounding}</>
            ) : casePricing.isFoundingPrice ? (
              <>{t.hero.foundingOpen}</>
            ) : (
              <>The ${casePricing.foundingFee} {t.hero.foundingEnded}</>
            )}
          </p>
          <p className="font-display mt-5 max-w-2xl text-xl italic leading-snug text-[var(--gold)] sm:text-2xl">
            {t.hero.pull}
          </p>
          <p className="mt-4 max-w-2xl space-y-1 text-sm text-white/85">
            <span className="block">{t.hero.inviteEs}</span>
            <span className="block">{t.hero.inviteVi}</span>
            <span className="block">{t.hero.inviteZh}</span>
            <span className="block">{t.hero.inviteLo}</span>
            <span className="block">{t.hero.inviteHi}</span>
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#case529" className={btnGold}>
              {FORMATION_MODE ? t.formation.caseCtaSoon : `${t.hero.ctaCase} — $${nextCaseFee} ${t.hero.ctaCaseSuffix}`}
            </a>
            <a
              href="#access529"
              className="inline-flex items-center justify-center rounded-lg border border-white/40 px-5 py-2.5 text-base font-semibold text-white"
            >
              {t.hero.ctaHow}
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4">
        {/* ---------- The companion: she knows your child ---------- */}
        <figure className="pt-8">
          <video
            src={companionVideo}
            poster={companionImg}
            autoPlay
            muted
            loop
            playsInline
            aria-label={t.founderWalk.alt}
            className="w-full rounded-2xl border border-[var(--border)]"
          />
          <figcaption className="font-display mt-4 text-center text-xl italic leading-snug sm:text-2xl">
            {t.founderWalk.caption}
          </figcaption>
        </figure>

        {/* ---------- At a glance: the whole draft on one screen ---------- */}
        <section id="glance" aria-label={t.glance.title} className="py-10">
          <SectionWithLogo sub={t.glance.sub}>
            {t.glance.title}
          </SectionWithLogo>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {t.glance.cards.map((c, i) => (
              <article key={i} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <h3 className="font-display text-lg font-semibold leading-snug">{i === 0 ? `$${nextCaseFee} — ${FORMATION_MODE ? t.formation.glanceTitle : c.t}` : c.t}</h3>
                <p className="mt-1.5 text-sm text-[var(--dim)]">{i === 0 && FORMATION_MODE ? t.formation.glanceBody : c.d}</p>
              </article>
            ))}
            <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <h3 className="font-display text-lg font-semibold leading-snug">{t.withdrawal.glanceT}</h3>
              <p className="mt-1.5 text-sm text-[var(--dim)]">{t.withdrawal.glanceD}</p>
            </article>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <a href="#case529" className={btnGold}>{FORMATION_MODE ? t.formation.caseCtaSoon : `${t.glance.ctaCase} — $${nextCaseFee} ${t.hero.ctaCaseSuffix}`}</a>
            <a href="#withdrawal" className={btnGhost}>{t.withdrawal.title.split(" — ")[0]}</a>
            <a href="#subscribe" className={btnGhost}>{t.glance.ctaWaitlist}</a>
          </div>
        </section>

        {/* ---------- The train is moving: the real 529 numbers ---------- */}
        <OnBoardSection casePricing={casePricing} />

        {/* ---------- The case door (front door) ---------- */}
        <CaseDoorSection casePricing={casePricing} />

        {/* ---------- Guided Withdrawal (the other end of the journey) ---------- */}
        <WithdrawalSection withdrawalPricing={withdrawalPricing} />

        {/* ---------- Self-service doors + the family journey ---------- */}
        <DoorsAndJourney />
        <IntlStudentsSection />

        {/* ---------- For parents: why the Center, using the fund, the benefits ---------- */}
        <ParentsBenefitsSection casePricing={casePricing} withdrawalPricing={withdrawalPricing} />

        {/* ---------- Compliance ---------- */}
        <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
          <p className="text-base">
            <strong>{t.legal.briefStrong}</strong> {t.legal.brief} (${nextCaseFee})
          </p>
          <Details summary={t.legal.fullSummary}>
            <p className="text-base text-[var(--dim)]">
              Education Life Center USA operates under the laws of Oklahoma City, the State
              of Oklahoma, and the United States of America. The Center is a private
              membership company now being prepared — it is not a government agency, and it
              claims no government approval, endorsement, or partnership. Membership
              payments are made by fintech — card or bank transfer through a licensed
              payment provider — directly into the company's bank account; the Center never
              holds members' money for services, which are delivered with partners. The
              same rule holds for 529 Access: only a state can run a 529 plan, so a parent's
              529 money goes directly from the parent to Oklahoma's state plan — the Center
              guides, tracks, and reminds, and never holds 529 money or gives personal
              investment advice. The 529 case service charges a flat fee for guidance —
              ${casePricing.foundingFee} founding price for the first {casePricing.foundingLimit} completed cases
              (the next case is ${nextCaseFee}) — due only when a case succeeds, never a percentage of any account,
              and advisor-sold 529 guidance carries no success fee. Guided Withdrawal
              sittings carry one simple flat fee, due only
              when a sitting completes (the withdrawal correctly
              requested by the account owner and on its way), never a percentage of any
              withdrawal; the sitting is general education and paperwork guidance only,
              not investment advice and not tax preparation, and the owner requests every
              withdrawal themselves — the Center never logs into a 529 account, never
              holds an owner's password, and never moves 529 money.
            </p>
          </Details>
        </div>

        {/* ---------- Automation pipeline ---------- */}
        <section aria-label={t.pipeline.title} className="py-8">
          <SectionWithLogo sub={t.pipeline.sub}>
            {t.pipeline.title}
          </SectionWithLogo>
          <Details summary={t.pipeline.summary}>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {t.pipeline.steps.map((step, i) => (
              <li
                key={i}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
              >
                <span className="font-display flex h-9 w-9 items-center justify-center rounded-full bg-[var(--gold-soft)] text-lg font-bold text-[var(--gold)]">
                  {i + 1}
                </span>
                <h3 className="mt-3 font-semibold">{step.t}</h3>
                <p className="mt-1 text-sm text-[var(--dim)]">{step.d}</p>
              </li>
            ))}
          </ol>
          </Details>
        </section>

        {/* ---------- Services ---------- */}
        <section id="services" aria-label={t.nav.services} className="py-6">
          <SectionWithLogo sub={`${t.services.subA} $${nextCaseFee} ${t.services.subB}`}>
            {t.services.title}
          </SectionWithLogo>
          <div className="grid gap-4 md:grid-cols-2">
            {t.services.items.map((s, idx) => (
              <article
                key={s.no}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-[var(--gold)]">
                  {s.no}
                </p>
                <h3 className="font-display mt-1 text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-base font-semibold text-[var(--text)]">{s.hook}</p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {s.points.map((p) => (
                    <li
                      key={p}
                      className="rounded-full bg-[var(--gold-soft)] px-3 py-1 text-sm font-medium text-[var(--text)]"
                    >
                      {p}
                    </li>
                  ))}
                </ul>
                <Details summary={t.services.more}>
                  <p className="text-base text-[var(--dim)]">{t.services.details[idx] ?? SERVICES[idx]?.text ?? ""}</p>
                </Details>
              </article>
            ))}
          </div>
          <Details summary={t.services.familySummary}>
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] md:flex">
            <img
              src={familyImg}
              alt="A mother fitting her young son's school backpack at home before the school day"
              className="h-52 w-full object-cover md:h-auto md:w-2/5"
            />
            <div className="p-5 md:w-3/5">
              <h3 className="font-display text-xl font-semibold">
                {t.services.familyTitle}
              </h3>
              <p className="mt-2 text-base font-semibold text-[var(--text)]">
                {t.services.familyHook}
              </p>
              <p className="mt-2 text-base text-[var(--dim)]">
                {t.services.familyBody}
              </p>
              <img
                src={okcImg}
                alt="The Oklahoma City skyline at dusk"
                className="mt-4 h-28 w-full rounded-lg object-cover"
              />
              <p className="mt-2 text-sm text-[var(--dim)]">
                {t.services.familyCaption}
              </p>
            </div>
          </div>
          </Details>
        </section>

        {/* ---------- Coming later (parked) ---------- */}
        <section id="later" aria-label={t.services.laterTitle} className="py-6">
          <SectionWithLogo sub={t.services.laterSub}>
            {t.services.laterTitle}
          </SectionWithLogo>
          <div className="grid gap-4 md:grid-cols-2">
            {PARKED_SERVICES.map((s) => (
              <article
                key={s.no}
                className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-5 opacity-90"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-[var(--gold)]">
                    {t.services.laterNo}
                  </p>
                  <span className="rounded-full border border-[var(--gold)] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[var(--gold)]">
                    {t.services.laterBadge}
                  </span>
                </div>
                <h3 className="font-display mt-1 text-xl font-semibold">{t.services.laterName}</h3>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {t.services.laterPoints.map((p) => (
                    <li
                      key={p}
                      className="rounded-full bg-[var(--gold-soft)] px-3 py-1 text-sm font-medium text-[var(--text)]"
                    >
                      {p}
                    </li>
                  ))}
                </ul>
                <Details summary={t.services.more}>
                  <p className="text-base text-[var(--dim)]">{t.services.laterText}</p>
                </Details>
              </article>
            ))}
          </div>
        </section>

        {/* ---------- 529 Access ---------- */}
        <Access529Section
          isMember={memberEmail != null}
          casePricing={casePricing}
        />

        {/* ---------- Membership plan ---------- */}
        <section id="plans" aria-label={t.plans.title} className="py-10">
          <SectionWithLogo sub={t.plans.sub}>
            {t.plans.title}
          </SectionWithLogo>
          <p className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-base">
            <strong>{t.plans.noteStrong}</strong> {t.plans.noteA} ${nextCaseFee} {t.plans.noteB}
          </p>
          <Details summary={t.plans.billingSummary}>
            <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-base text-[var(--dim)]">
              {t.plans.billingBody}
            </p>
          </Details>
          <div className="grid gap-4 md:grid-cols-1 max-w-2xl">
            {TIER_OPTIONS.map((tier, idx) => (
              <article
                key={tier.key}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
              >
                <h3 className="font-display text-xl font-semibold">{t.plans.tiers[idx]?.label ?? tier.label}</h3>
                <p className="mt-2">
                  <span className="font-display text-4xl font-semibold">${tier.price}</span>
                  <span className="text-[var(--dim)]"> {t.plans.perMonth}</span>
                </p>
                <p className="mt-2 text-base text-[var(--dim)]">{t.plans.tiers[idx]?.blurb ?? tier.blurb}</p>
                <p className="mt-3 text-sm font-medium text-[var(--good)]">
                  {t.plans.perYear}
                </p>
              </article>
            ))}
          </div>
          <p className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--gold-soft)] p-4 text-base">
            <strong>{t.plans.referralStrong}</strong> {t.plans.referral}
          </p>
        </section>

        {/* ---------- Membership waitlist / sign in / dashboard ---------- */}
        {memberEmail == null ? (
          <section id="subscribe" aria-label={t.waitlist.title} className="py-6">
            <SectionWithLogo sub={t.waitlist.sub}>
              {t.waitlist.title}
            </SectionWithLogo>
            <WaitlistForm />
            <SignInForm onSignedIn={(email, key) => { setMemberEmail(email); setMemberKey(key); }} />
          </section>
        ) : (
          <section id="dashboard" aria-label={t.dashboardSection.title} className="py-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                <LogoMark className="h-14 w-14 sm:h-16 sm:w-16" />
                <SectionTitle sub={t.dashboardSection.sub}>
                  {t.dashboardSection.title}
                </SectionTitle>
              </div>
              <button type="button" className={btnGhost} onClick={signOut}>
                {t.dashboardSection.signOut}
              </button>
            </div>
            {justJoined && dashboard.data ? (
              <p className="mb-5 rounded-xl border border-[var(--good)] bg-[var(--surface)] p-4 text-base">
                <strong>Welcome aboard — you are subscribed.</strong> Member number{" "}
                <strong>{dashboard.data.member.memberNumber}</strong> is active, your Member
                Card has been issued, and invoice{" "}
                {dashboard.data.invoices[0]?.invoiceNumber} is scheduled (due at launch —
                nothing charged today). Your referral code is{" "}
                <strong>{dashboard.data.member.referralCode}</strong>.
              </p>
            ) : null}
            {dashboard.isPending ? <p className="text-[var(--dim)]">{t.dashboardSection.loading}</p> : null}
            {dashboard.error ? (
              <p className="text-red-700">Could not load your dashboard. Please sign in again.</p>
            ) : null}
            {dashboard.data ? <DashboardView data={dashboard.data} /> : null}
          </section>
        )}

        {/* ---------- Jobs: public open-jobs preview, then the members-only board ---------- */}
        <JobsPreviewSection />
        <JobsSection memberId={memberId} memberEmail={memberEmail} />

        {/* ---------- Partners ---------- */}
        <PartnersSection />

        {/* ---------- Partner card verification ---------- */}
        <PartnerVerifySection />

        {/* ---------- Admin — operations, staff only ---------- */}
        <AdminSection />

        {/* ---------- Closing invitation ---------- */}
        <section aria-label={t.closing.title} className="pb-12">
          <div className="rounded-xl bg-[#16294d] px-5 py-8 text-white sm:px-8">
            <h2 className="font-display max-w-3xl text-3xl font-semibold leading-tight sm:text-4xl">
              {t.closing.title}
            </h2>
            <p className="mt-3 max-w-2xl text-lg text-white/85">
              {t.closing.bodyA} ${nextCaseFee} {t.closing.bodyB}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#case529" className={btnGold}>
                {t.closing.ctaCase} — ${nextCaseFee} {t.hero.ctaCaseSuffix}
              </a>
              <a
                href="#subscribe"
                className="inline-flex items-center justify-center rounded-lg border border-white/40 px-5 py-2.5 text-base font-semibold text-white"
              >
                {t.closing.ctaWaitlist}
              </a>
            </div>
            <p className="mt-4 text-sm text-white/70">
              {t.closing.footnote}
            </p>
          </div>
        </section>

        <footer className="border-t border-[var(--border)] py-8 text-sm text-[var(--dim)]">
          <div className="mb-4 flex items-center gap-3">
            <LogoMark className="h-16 w-16" />
            <div>
              <p className="font-display text-base font-semibold text-[var(--text)]">Education Life Center USA</p>
              <p>{t.hero.location}</p>
            </div>
          </div>
          <p>
            {t.footer.tagline}
          </p>
          <p className="mt-2">
            Contact: <a href="mailto:contact@educationlifecenterusa.com" className="font-semibold text-[var(--text)] hover:underline">contact@educationlifecenterusa.com</a>
          </p>
          <Details summary={t.footer.fineSummary}>
            <p className="text-[var(--dim)]">
              The Center opens with the 529 case door: a flat fee for guidance — ${casePricing.foundingFee} founding price for the first {casePricing.foundingLimit} completed cases; the next case is ${nextCaseFee} — due only when a case succeeds
              and never a percentage of any account; advisor-sold 529 guidance carries no
              success fee. The membership opens later, as the ongoing relationship behind
              the case door. Membership payments are made by fintech — card or bank transfer
              through a licensed payment provider — directly into the company's bank
              account, with automatic confirmation and receipts; the Center never holds
              members' money for services. Family Credit Support is provided through
              partner banks and credit unions, which review each application and make the
              decision — the Center itself never lends, and no outcome is promised before a
              partner decides. Term Advance is built into the system and opens later; it is
              not offered yet. 529 Access is guidance and tracking only: 529 plans are run
              by the state of Oklahoma, parents open and fund their accounts directly with
              the state plan, and the Center provides general education — not personal
              investment advice — and never holds 529 money. Guided Withdrawal sittings —
              the guided service for taking money out when it is needed — carry one simple
              flat fee, due only when a sitting completes
              and never a percentage of any withdrawal; the
              account owner requests every withdrawal themselves on the state plan's site,
              and the Center only guides. The self-service doors are free to use: every
              government application is filed by the family themselves on the official
              website and is always free. If a family completes a guided-tier door
              entirely by self-service through this site and reports the completion, a
              flat $25 navigation success fee falls due — it pays for the Center's
              navigation service (the matched door list, step guidance, AI help, journey
              tracking, email reports, and the completion record on file), never for a
              government form, application, or benefit; pointer-tier doors carry no fee,
              and completions are the family's own reports — official websites do not
              report back to the Center. A self-service completion is a navigation
              completion and does not use a founding guided-case spot.
            </p>
          </Details>
          <p className="mt-3">© 2026 Education Life Center USA</p>
          <div className="mt-4 flex justify-end">
            <a href="#admin" className="inline-flex items-center justify-center rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text)] hover:underline">{t.nav.admin}</a>
          </div>
        </footer>
      </main>
      <AssistantPanel />
    </div>
  );
}

// ---------------------------------------------------------------------------
// For parents — the three questions every parent asks, answered on the page
// (Founder request, 2026-11-12): (1) why use the Center when registering at
// Oklahoma529.com is free, (2) how the 529 money is actually used when a
// child needs it, and (3) what parents gain from each service. The wording
// follows the answers already given to the Founder in the parent
// conversation: the Center sells completion, not the account; a 529 is
// never a loan — money comes out only by withdrawal; withdrawal timings
// are typical-practice estimates, not state guarantees.
// ---------------------------------------------------------------------------

function IntlStudentsSection() {
  const { t } = useLang();
  const visas = [t.intl.f1, t.intl.j1, t.intl.m1];
  return (
    <section id="intl" aria-label={t.intl.title} className="py-10">
      <SectionWithLogo sub={t.intl.sub}>{t.intl.title}</SectionWithLogo>
      <div className="grid gap-4 md:grid-cols-3">
        {visas.map((v) => (
          <article key={v.tag} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h3 className="font-display text-lg font-semibold leading-snug">{v.tag}</h3>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[#14532d]">{t.intl.openLabel}</p>
            <ul className="mt-1 space-y-1 text-sm text-[var(--dim)]">
              {v.open.map((s) => (
                <li key={s}>✓ {s}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-red-700">{t.intl.closedLabel}</p>
            <ul className="mt-1 space-y-1 text-sm text-[var(--dim)]">
              {v.closed.map((s) => (
                <li key={s}>✕ {s}</li>
              ))}
            </ul>
            {v.limited ? (
              <p className="mt-3 rounded-lg bg-[var(--gold-soft)] p-3 text-sm font-medium">
                {t.intl.limitedLabel}: {v.limited}
              </p>
            ) : null}
          </article>
        ))}
      </div>
      <article className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h3 className="font-display text-lg font-semibold">{t.intl.depTitle}</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--dim)]">
          {t.intl.dep.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </article>
      <p className="mt-4 rounded-lg bg-[var(--gold-soft)] px-4 py-3 text-sm">
        <strong>{t.intl.noncitizen}</strong>
      </p>
      <p className="mt-3 text-base text-[var(--dim)]">{t.intl.note529}</p>
      <p className="mt-3 text-xs text-[var(--dim)]">{t.intl.disclaimer}</p>
    </section>
  );
}

function ParentsBenefitsSection({ casePricing, withdrawalPricing }: { casePricing: CasePricing; withdrawalPricing: WithdrawalPricing }) {
  const { t } = useLang();
  const nextFee = casePricing.nextCaseFee;
  return (
    <section id="parents" aria-label="For parents — why use the Center, how 529 money is used, and what parents gain" className="py-10">
      <SectionWithLogo
        logoClassName="h-16 w-16 sm:h-20 sm:w-20"
        sub={t.parents.sub}
      >
        {t.parents.title}
      </SectionWithLogo>

      {/* 1 — Why use the Center when the state site is free? */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--gold)]">
          {t.parents.q1}
        </p>
        <h3 className="font-display mt-1 text-xl font-semibold">
          {t.parents.q1Title}
        </h3>
        <p className="mt-2 text-base text-[var(--dim)]">
          <strong className="text-[var(--text)]">{t.parents.q1LeadStrong}</strong>{" "}
          {t.parents.q1Lead}
        </p>
        <p className="mt-3 text-base text-[var(--dim)]">
          {t.parents.q1SecondA} <strong className="text-[var(--text)]">{t.parents.q1SecondStrong}</strong>{" "}
          {t.parents.q1SecondB}
        </p>
        <Details summary={t.parents.barriersSummary}>
        <p className="text-base text-[var(--dim)]">
          {t.parents.barriersIntro}
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {t.parents.barriers.map((b) => (
            <article key={b.t} className="rounded-lg border border-[var(--border)] p-4">
              <h4 className="font-semibold">{b.t}</h4>
              <p className="mt-1 text-sm text-[var(--dim)]">{b.d}</p>
            </article>
          ))}
        </div>
        <p className="mt-4 text-base text-[var(--dim)]">
          {t.parents.q1Close} (${nextFee})
        </p>
        </Details>
      </div>

      {/* 2 — How the fund is used when needed */}
      <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--gold)]">
          {t.parents.q2}
        </p>
        <h3 className="font-display mt-1 text-xl font-semibold">
          {t.parents.q2Title}
        </h3>
        <p className="mt-2 text-base text-[var(--dim)]">
          <strong className="text-[var(--text)]">{t.parents.q2LeadStrong}</strong>{" "}
          {t.parents.q2Lead}
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-[var(--border)] p-4">
            <h4 className="font-semibold">{t.parents.clock1Title}</h4>
            <p className="mt-1 text-sm text-[var(--dim)]">
              {t.parents.clock1Body}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--border)] p-4">
            <h4 className="font-semibold">{t.parents.clock2Title}</h4>
            <p className="mt-1 text-sm text-[var(--dim)]">
              {t.parents.clock2Body}
            </p>
          </div>
        </div>
        <p className="mt-4 rounded-lg bg-[var(--gold-soft)] p-3 text-base font-medium">
          {t.withdrawal.noCredit}
        </p>
        <Details summary={t.parents.withdrawSummary}>
        <ol className="space-y-3">
          {[
            { t: "Pay a qualified expense — and keep the receipts", d: "Tuition, fees, books, supplies and equipment; room and board if the student is enrolled at least half-time; K–12 expenses — tuition, curriculum and books, online materials, tutoring, test fees, dual-enrollment fees and therapies (all of them combined up to $20,000 a year for tax years after December 31, 2025, per child across all 529 plans); registered apprenticeship costs. This is what makes the withdrawal tax-free. The plan does not ask for receipts when you withdraw — but keep them: you must be able to prove the qualified use if the IRS or Oklahoma ever asks." },
            { t: "Mind the same-calendar-year rule", d: "The withdrawal must fall in the same calendar year as the payment. Pay the school in December and withdraw the next January, and the IRS can treat it as non-qualified. Pay, keep the receipts, withdraw in the same year — this is exactly the detail guided setup prevents families from getting wrong." },
            { t: "Request the withdrawal — the owner does it", d: "Only the account owner requests it, and the plan can send the money to the owner, to the student, straight to the school, or to another third party (a non-qualified withdrawal can be paid only to the owner or the student). The Center never logs into your account or moves your money — we guide, you act." },
            { t: "Start at least two weeks before the school's deadline", d: "The plan's own security holds can stretch the timing: no withdrawal of a contribution until 8 business days after the plan receives it, 20 business days after a mailing-address change, and 30 calendar days after a banking-information change or an ownership transfer (these are identity-protection holds, not credit checks) — and a request of $100,000 or more needs a medallion signature guarantee. The August rush slows everything further when every family withdraws for fall tuition at once. The family that starts two weeks ahead never pays a late fee." },
          ].map((s, i) => (
            <li key={s.t} className="flex gap-3">
              <span className="font-display flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--gold-soft)] text-base font-bold text-[var(--gold)]">
                {i + 1}
              </span>
              <div>
                <p className="font-semibold">{s.t}</p>
                <p className="text-sm text-[var(--dim)]">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg bg-[var(--gold-soft)] p-3 text-sm">
            <p className="font-semibold">The one place a loan appears</p>
            <p className="mt-1">
              A 529 can <strong>repay a student loan</strong> — up to $10,000 per person, once
              in a lifetime (and another $10,000 for each sibling's loan), tax-free. The fund
              can retire a loan after school; it just can't <em>be</em> one during school.
              One honest limit: a parent's own <strong>Parent PLUS</strong> loan cannot be
              repaid from the student's account, because the loan must belong to the
              beneficiary or a sibling — but the account owner can change the beneficiary
              to the parent borrower, and then up to $10,000 of the parent's PLUS loan can
              qualify under the parent's own lifetime limit.
            </p>
          </div>
          <div className="rounded-lg bg-[var(--gold-soft)] p-3 text-sm">
            <p className="font-semibold">If you take money out for something else</p>
            <p className="mt-1">
              It still works — it is your money, never locked in a vault. Your contributions
              always come back tax-free; only the <em>earnings</em> part is taxed as income
              plus a 10% federal penalty, and Oklahoma may take back any state tax deduction
              you claimed on that money. The 10% penalty itself has exceptions — a
              scholarship or other tax-free educational assistance (including veterans'
              and employer-provided assistance), the student's death or permanent
              disability, attendance at a U.S. military academy, and amounts equal to
              expenses counted toward the American Opportunity or Lifetime Learning
              credits — though tax on the earnings still applies in those cases. For
              qualified education use, nothing is clawed back.
            </p>
          </div>
          <div className="rounded-lg bg-[var(--gold-soft)] p-3 text-sm">
            <p className="font-semibold">How long the fund can live: no deadline</p>
            <p className="mt-1">
              No "use by age 18," no forced withdrawals, ever. If your child doesn't need it,
              change the beneficiary to another family member — a sibling, a future
              grandchild, even yourself — or, once the account is 15 years old, roll up to
              $35,000 over a lifetime into the beneficiary's Roth IRA: the money moved must
              have been in the account more than 5 years, the rollover counts against that
              year's Roth IRA contribution limit (so it cannot exceed the beneficiary's
              earned income for the year), it must go directly from the plan to the Roth
              IRA — and the usual Roth IRA income limits are waived for these rollovers.
              Oklahoma's only ceiling: contributions stop at $450,000 per beneficiary
              across both Oklahoma plans; growth on top of that is fine.
            </p>
          </div>
        </div>
        <p className="mt-4 text-base text-[var(--dim)]">
          And when a family needs cash <em>before</em> there is an education expense, the 529
          is the wrong tool — we say so. That need belongs to Family Credit Support with the
          partner banks. The 529 is the savings side; the banks are the borrowing side; the
          Center never mixes the two.
        </p>
        </Details>
      </div>

      {/* 3 — What parents gain from each service */}
      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--gold)]">
          {t.parents.q3}
        </p>
        <h3 className="font-display mt-1 text-xl font-semibold">
          {t.parents.q3Title}
        </h3>
        <p className="mt-2 max-w-3xl text-base text-[var(--dim)]">
          {t.parents.q3Intro}
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <article className="rounded-xl border-2 border-[var(--gold)] bg-[var(--surface)] p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--gold)]">
              {FORMATION_MODE ? t.formation.caseKickerSoon : t.parents.caseCardKicker}
            </p>
            <h4 className="font-display mt-1 text-lg font-semibold">{t.parents.caseCardTitle} — ${nextFee}</h4>
            <p className="mt-2 text-base text-[var(--dim)]">{t.parents.caseCardSummary}</p>
            <Details summary={t.parents.gainSummary}>
            <ul className="list-disc space-y-1.5 pl-5 text-base text-[var(--dim)]">
              <li>A savings goal for your child, calculated against real Oklahoma college costs — about $22,600 a year all-in, roughly $90,400 for four years (a yardstick, not a promise).</li>
              <li>Both state plans explained in plain language — direct Oklahoma 529 and advisor-sold OklahomaDream 529 — what each is, how each works, what each costs.</li>
              <li>The account actually opened — by you, in your name, on the state's official site, with the Center beside you step by step — instead of another tab left open.</li>
              <li>The first automatic monthly contribution arranged, at an amount your family can actually keep — the step most families never reach alone.</li>
              <li>Risk removed: nothing is charged to start, a case that doesn't finish costs nothing, the fee is flat (never a percentage of your account), and your case keeps the price it started with. Advisor-sold cases carry no success fee at all.</li>
            </ul>
            </Details>
          </article>
          <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--gold)]">
              {t.parents.memberCardKicker}
            </p>
            <h4 className="font-display mt-1 text-lg font-semibold">{t.parents.memberCardTitle}</h4>
            <p className="mt-2 text-base text-[var(--dim)]">{t.parents.memberCardSummary}</p>
            <Details summary={t.parents.gainSummary}>
            <ul className="list-disc space-y-1.5 pl-5 text-base text-[var(--dim)]">
              <li>One membership for the whole education life: join once, participate every year — and children are covered free under the same membership, each with their own profile.</li>
              <li>A digital Member Card issued by the system the moment you subscribe, carrying your member number everywhere in the Center.</li>
              <li>529 Access on your dashboard: a goal for each child, your progress shown honestly (contributions only — no growth promised), and reminders that keep the monthly habit alive past the first month.</li>
              <li>A referral reward handled by the system: when 10 people subscribe with your code, a free year is granted automatically — and every further block of 10 earns another.</li>
            </ul>
            </Details>
          </article>
          <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--gold)]">
              {t.parents.jobCardKicker}
            </p>
            <h4 className="font-display mt-1 text-lg font-semibold">{t.parents.jobCardTitle}</h4>
            <p className="mt-2 text-base text-[var(--dim)]">{t.parents.jobCardSummary}</p>
            <Details summary={t.parents.gainSummary}>
            <ul className="list-disc space-y-1.5 pl-5 text-base text-[var(--dim)]">
              <li>For parents seeking work and for young people finishing school: a real board of Oklahoma openings, posted by employers.</li>
              <li>One-tap applications — the system forwards yours to the employer automatically and tracks the answer on your dashboard, so no application disappears into a pile.</li>
              <li>Education ends at the goal line — a first job. This is the service that carries a graduate across it.</li>
            </ul>
            </Details>
          </article>
          <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--gold)]">
              {t.parents.creditCardKicker}
            </p>
            <h4 className="font-display mt-1 text-lg font-semibold">{t.parents.creditCardTitle}</h4>
            <p className="mt-2 text-base text-[var(--dim)]">{t.parents.creditCardSummary}</p>
            <Details summary={t.parents.gainSummary}>
            <ul className="list-disc space-y-1.5 pl-5 text-base text-[var(--dim)]">
              <li>For the bigger needs a 529 is not for — a car to reach work, home repairs, education costs that arrive before savings do.</li>
              <li>One application, filled in once: the system routes it to partner banks and credit unions, which review it and decide — and the decision is recorded on your dashboard.</li>
              <li>An honest broker beside you: the Center supports the application and never lends itself, so no one promises you an outcome before a partner decides.</li>
            </ul>
            </Details>
          </article>
          <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--gold)]">
              {FORMATION_MODE ? t.formation.gainKickerSoon : t.withdrawal.gainKicker}
            </p>
            <h4 className="font-display mt-1 text-lg font-semibold">{t.withdrawal.gainTitle}</h4>
            <p className="mt-2 text-base text-[var(--dim)]">{t.withdrawal.gainSummary}</p>
            <Details summary={t.parents.gainSummary}>
            <ul className="list-disc space-y-1.5 pl-5 text-base text-[var(--dim)]">
              {t.withdrawal.steps.map((s) => (
                <li key={s.t}><strong className="text-[var(--text)]">{s.t}.</strong> {s.d}</li>
              ))}
            </ul>
            <p className="mt-3 text-base text-[var(--dim)]">{t.withdrawal.railsNote}</p>
            </Details>
          </article>
        </div>
        <p className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 text-base">
          <strong>{t.parents.acrossStrong}</strong> {t.parents.acrossBody}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a href="#case529" className={btnGold}>
            {t.parents.ctaCase} — ${nextFee} {t.hero.ctaCaseSuffix}
          </a>
          <a href="#access529" className={btnGhost}>
            {t.parents.ctaHow}
          </a>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// The train is moving — the real 529 numbers (Founder request, 2026-11-12):
// show the published Oklahoma / national 529 totals on the page so a
// visiting family can see the group of people already saving — and that
// they may not be in that group yet, like standing on the platform while
// the train pulls out. The figures are the state plans' own published
// totals (December 31, 2025), NOT the Center's customers. The Center's
// own live counts are NOT shown here (Founder, 2026-11-13): they live
// only in the Admin area, behind the admin code.
// ---------------------------------------------------------------------------

function OnBoardSection({
  casePricing,
}: {
  casePricing: CasePricing;
}) {
  const { t } = useLang();
  const nextFee = casePricing.nextCaseFee;
  return (
    <section id="onboard" aria-label="How many families already save in a 529 — and whether yours is one of them yet" className="py-10">
      <SectionWithLogo
        logoClassName="h-16 w-16 sm:h-20 sm:w-20"
        sub={t.train.sub}
      >
        {t.train.title}
      </SectionWithLogo>

      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { k: t.train.k1, v: "89,849" },
          { k: t.train.k2, v: "$1.975 billion" },
          { k: t.train.k3, v: "17,686,941" },
          { k: t.train.k4, v: "$602.9 billion" },
        ].map((s) => (
          <div key={s.k} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
            <dd className="font-display text-3xl font-semibold">{s.v}</dd>
            <dt className="mt-1 text-xs font-medium uppercase tracking-wide text-[var(--dim)]">{s.k}</dt>
          </div>
        ))}
      </dl>

      <p className="mt-5 text-lg font-semibold">{t.train.families}</p>

      <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <p className="text-base text-[var(--dim)]">
          <strong className="text-[var(--text)]">{t.train.bodyStrong}</strong> {t.train.bodyRest} (${nextFee})
        </p>
        <p className="mt-3 rounded-lg bg-[var(--gold-soft)] px-4 py-3 text-sm">
          <strong>{t.train.separateStrong}</strong> {t.train.separateRest}
        </p>
        <Details summary={t.train.detailsSummary}>
          <p className="text-base text-[var(--dim)]">
            {t.train.detailsBody}
          </p>
        </Details>
        <div className="mt-4 flex flex-wrap gap-3">
          <a href="#case529" className={btnGold}>
            {FORMATION_MODE ? t.formation.caseCtaSoon : `${t.train.ctaBoard}, $${nextFee} ${t.hero.ctaCaseSuffix}`}
          </a>
          <a href="#parents" className={btnGhost}>
            {t.train.ctaParents}
          </a>
        </div>
        <p className="mt-4 text-xs text-[var(--dim)]">
          {t.train.footnote}
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Formation notice — replaces a door's intake form while the Center is
// in formation (Founder, 2026-11-13): the door is presented, priced, and
// explained, but it takes nothing yet — no case, no booking, no fee. The
// membership waitlist is the live intake, so the notice points there.
// ---------------------------------------------------------------------------

function FormationNotice({ kind }: { kind: "case" | "withdrawal" }) {
  const { t } = useLang();
  return (
    <div className="mt-6 rounded-xl border-2 border-[var(--gold)] bg-[var(--surface)] p-5" role="status">
      <p className="inline-block rounded-full bg-[var(--gold)] px-3 py-1 text-sm font-bold text-[#16294d]">
        {t.formation.badge}
      </p>
      <h3 className="font-display mt-3 text-xl font-semibold">
        {kind === "case" ? t.formation.caseNoticeTitle : t.formation.wdNoticeTitle}
      </h3>
      <p className="mt-2 max-w-3xl text-base text-[var(--dim)]">
        {kind === "case" ? t.formation.caseNoticeBody : t.formation.wdNoticeBody}
      </p>
      <a href="#subscribe" className={`${btnGold} mt-4`}>
        {t.formation.waitlistCta}
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The case door — one-time 529 case service, no membership needed.
// Pricing: $99 founding for the first 50 completed cases.
// In formation mode the door is shown as opening soon and takes no
// cases (FORMATION_MODE above; the server refuses startCase529 too).
// ---------------------------------------------------------------------------

function CaseDoorSection({
  casePricing,
}: {
  casePricing: CasePricing;
}) {
  const { t } = useLang();
  const nextFee = casePricing.nextCaseFee;
  return (
    <section id="case529" aria-label={FORMATION_MODE ? `529 case door — opening soon, in formation — $${nextFee} on success` : `Start a 529 case — $${nextFee} on success`} className="py-10">
      <SectionWithLogo
        logoClassName="h-16 w-16 sm:h-20 sm:w-20"
        sub={FORMATION_MODE ? t.formation.caseSub : t.caseDoor.sub}
      >
        {t.caseDoor.titleA} ${nextFee} {t.caseDoor.titleB}
      </SectionWithLogo>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-xl border-2 border-[var(--gold)] bg-[var(--surface)] p-5 lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--gold)]">
            {t.caseDoor.priceKicker}
          </p>
          <p className="mt-3">
            <span className="font-display text-5xl font-semibold">${nextFee}</span>
            <span className="text-[var(--dim)]"> {t.caseDoor.priceUnit}</span>
          </p>
          {FORMATION_MODE ? (
            <p className="mt-2 inline-block rounded-full bg-[var(--gold)] px-3 py-1 text-sm font-bold text-[#16294d]">
              {t.formation.badge}
            </p>
          ) : null}
          {casePricing.isFoundingPrice ? (
            <p className="mt-2 inline-block rounded-full bg-[var(--gold-soft)] px-3 py-1 text-sm font-semibold">
              {t.caseDoor.foundingOpenBadge}
            </p>
          ) : (
            <p className="mt-2 inline-block rounded-full bg-[var(--gold-soft)] px-3 py-1 text-sm font-semibold">
              {t.caseDoor.standardBadgeA} ${casePricing.foundingFee} {t.caseDoor.standardBadgeB} {casePricing.foundingLimit} {t.caseDoor.standardBadgeC}
            </p>
          )}
          <p className="mt-3 text-base font-medium text-[var(--good)]">
            {t.caseDoor.paidOnly}
          </p>
          <p className="mt-3 text-base text-[var(--dim)]">
            {t.caseDoor.buys}
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-base text-[var(--dim)]">
            <li>{t.caseDoor.bullet1}</li>
            <li>{t.caseDoor.bullet2} ${casePricing.foundingFee} {t.caseDoor.bullet2b} {casePricing.foundingLimit} {t.caseDoor.bullet2c}</li>
            <li>{t.caseDoor.bullet3}</li>
          </ul>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 lg:col-span-3">
          <h3 className="font-display text-lg font-semibold">{t.caseDoor.includesTitle}</h3>
          <p className="mt-1 text-sm text-[var(--dim)]">
            {t.caseDoor.includesSub}
          </p>
          <Details summary={t.caseDoor.stepsSummary}>
          <ol className="space-y-3">
            {t.caseDoor.steps.map((s, i) => (
              <li key={s.t} className="flex gap-3">
                <span className="font-display flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--gold-soft)] text-base font-bold text-[var(--gold)]">
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold">{s.t}</p>
                  <p className="text-sm text-[var(--dim)]">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
          </Details>
          <p className="mt-4 rounded-lg bg-[var(--gold-soft)] p-3 text-sm font-medium">
            {t.caseDoor.advisorNote}
          </p>
          <Details summary={t.caseDoor.afterSummary}>
            <p className="text-sm text-[var(--dim)]">
              {t.caseDoor.afterBody}
            </p>
          </Details>
        </div>
      </div>

      <SelfServiceStrip doorId="ok529" />

      {FORMATION_MODE ? (
        <FormationNotice kind="case" />
      ) : (
        <CaseStartForm casePricing={casePricing} />
      )}
    </section>
  );
}

function CaseStartForm({ casePricing }: { casePricing: CasePricing }) {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const [parentName, setParentName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Oklahoma City");
  const [childName, setChildName] = useState("");
  const [planChoice, setPlanChoice] = useState<"oklahoma_529" | "oklahomadream_529" | "undecided">("oklahoma_529");
  const [goalAmount, setGoalAmount] = useState("25000");
  const [monthlyContribution, setMonthlyContribution] = useState("100");
  const [error, setError] = useState<string | null>(null);

  const start = useMutation({
    mutationFn: () =>
      api.startCase529({
        parentName: parentName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        city: city.trim() || "Oklahoma City",
        childName: childName.trim(),
        planChoice,
        goalAmount: Number(goalAmount) || 0,
        monthlyContribution: Number(monthlyContribution) || 0,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["public-stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: () => setError(t.caseDoor.formError),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    start.mutate();
  };

  if (start.data) {
    const c = start.data.case529;
    return (
      <div className="mt-6 rounded-xl border border-[var(--good)] bg-[var(--surface)] p-5" role="status">
        <h3 className="font-display text-xl font-semibold">{t.caseDoor.successTitle} — {c.caseNumber}</h3>
        <p className="mt-2 text-base">
          {t.caseDoor.successBodyA} <strong>{c.childName}</strong> ({plan529Label(c.planChoice)}).
          {t.caseDoor.successBodyB} <strong>{c.email}</strong> {t.caseDoor.successBodyC}
        </p>
        <p className="mt-2 text-base font-medium">
          {c.feeStatus === "not_due"
            ? t.caseDoor.successNoFee
            : `${t.caseDoor.successFeeA} $${c.feeAmount} ${t.caseDoor.successFeeB}`}
        </p>
        <button
          type="button"
          className={`${btnGhost} mt-4`}
          onClick={() => start.reset()}
        >
          {t.caseDoor.startAnother}
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
    >
      <h3 className="font-display text-lg font-semibold">{t.caseDoor.formTitle}</h3>
      <p className="mt-1 text-sm text-[var(--dim)]">
        {t.caseDoor.formSubA}{" "}
        {casePricing.isFoundingPrice
          ? `$${casePricing.nextCaseFee} — ${t.caseDoor.formSubFounding}`
          : `$${casePricing.nextCaseFee} — ${t.caseDoor.formSubStandard}`}
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label htmlFor="case-parent" className={labelCls}>{t.forms.parentName}</label>
          <input id="case-parent" className={inputCls} value={parentName} onChange={(e) => setParentName(e.target.value)} required autoComplete="name" placeholder="e.g. Maria Gonzalez" />
        </div>
        <div>
          <label htmlFor="case-email" className={labelCls}>{t.forms.email}</label>
          <input id="case-email" type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com" />
        </div>
        <div>
          <label htmlFor="case-phone" className={labelCls}>{t.forms.phoneOpt}</label>
          <input id="case-phone" type="tel" className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="(405) 555-0100" />
        </div>
        <div>
          <label htmlFor="case-child" className={labelCls}>{t.forms.childNameCase}</label>
          <input id="case-child" className={inputCls} value={childName} onChange={(e) => setChildName(e.target.value)} required placeholder="e.g. Sofia Gonzalez" />
        </div>
        <div>
          <label htmlFor="case-plan" className={labelCls}>{t.forms.plan}</label>
          <select id="case-plan" className={inputCls} value={planChoice} onChange={(e) => setPlanChoice(e.target.value as typeof planChoice)}>
            <option value="oklahoma_529">{t.forms.planDirect}</option>
            <option value="oklahomadream_529">{t.forms.planAdvisor}</option>
            <option value="undecided">{t.forms.planUndecided}</option>
          </select>
        </div>
        <div>
          <label htmlFor="case-city" className={labelCls}>{t.forms.city}</label>
          <input id="case-city" className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="case-goal" className={labelCls}>{t.forms.goal}</label>
          <input id="case-goal" type="number" min={0} max={1000000} className={inputCls} value={goalAmount} onChange={(e) => setGoalAmount(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="case-monthly" className={labelCls}>{t.forms.monthly}</label>
          <input id="case-monthly" type="number" min={0} max={100000} className={inputCls} value={monthlyContribution} onChange={(e) => setMonthlyContribution(e.target.value)} required />
        </div>
      </div>
      {error ? <p className="mt-4 text-base text-red-700">{error}</p> : null}
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button type="submit" className={btnGold} disabled={start.isPending}>
          {start.isPending ? t.caseDoor.saving : t.caseDoor.submit}
        </button>
        <p className="text-sm text-[var(--dim)]">
          ${casePricing.nextCaseFee} {t.caseDoor.submitNoteA}
        </p>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Guided Withdrawal — the completed service at the other end of the
// journey (Founder, 2026-11-12). One simple price (Founder's fee
// ruling) — read live from
// getPublicStats (withdrawalPricing), due only
// when the sitting completes, never a percentage of the withdrawal.
// The owner requests the withdrawal themselves on the state plan's
// site; the Center guides, never touches the money, never holds the
// password, and gives general education only — not investment advice,
// not tax preparation.
// ---------------------------------------------------------------------------

const WITHDRAWAL_PURPOSE_KEYS = [
  "college",
  "k12_tuition",
  "student_loan",
  "apprenticeship",
  "roth_rollover",
  "other_qualified",
] as const;

type WithdrawalPurpose = (typeof WITHDRAWAL_PURPOSE_KEYS)[number];

function WithdrawalSection({
  withdrawalPricing,
}: {
  withdrawalPricing: WithdrawalPricing;
}) {
  const { t } = useLang();
  return (
    <section id="withdrawal" aria-label={FORMATION_MODE ? `Guided withdrawal sittings — opening soon, in formation` : `Book a guided withdrawal sitting`} className="py-10">
      <SectionWithLogo
        logoClassName="h-16 w-16 sm:h-20 sm:w-20"
        sub={FORMATION_MODE ? t.formation.wdSub : t.withdrawal.sub}
      >
        {t.withdrawal.title}
      </SectionWithLogo>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-xl border-2 border-[var(--gold)] bg-[var(--surface)] p-5 lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--gold)]">
            {t.withdrawal.priceKicker}
          </p>
          {FORMATION_MODE ? (
            <p className="mt-2 inline-block rounded-full bg-[var(--gold)] px-3 py-1 text-sm font-bold text-[#16294d]">
              {t.formation.badge}
            </p>
          ) : null}
          <p className="mt-2 inline-block rounded-full bg-[var(--gold-soft)] px-3 py-1 text-sm font-semibold">
            {t.withdrawal.samePrice}
          </p>
          <p className="mt-3 text-base font-medium text-[var(--good)]">
            {t.withdrawal.paidOnly}
          </p>
          <p className="mt-3 text-base text-[var(--dim)]">
            {t.withdrawal.buys}
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-base text-[var(--dim)]">
            <li>{t.withdrawal.bullet1}</li>
            <li>{t.withdrawal.bullet2}</li>
            <li>{t.withdrawal.bullet3}</li>
          </ul>
          <p className="mt-4 rounded-lg bg-[var(--gold-soft)] p-3 text-base font-medium">
            {t.withdrawal.noCredit}
          </p>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 lg:col-span-3">
          <h3 className="font-display text-lg font-semibold">{t.withdrawal.includesTitle}</h3>
          <p className="mt-1 text-sm text-[var(--dim)]">
            {t.withdrawal.includesSub}
          </p>
          <Details summary={t.withdrawal.stepsSummary}>
          <ol className="space-y-3">
            {t.withdrawal.steps.map((s, i) => (
              <li key={s.t} className="flex gap-3">
                <span className="font-display flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--gold-soft)] text-base font-bold text-[var(--gold)]">
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold">{s.t}</p>
                  <p className="text-sm text-[var(--dim)]">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
          </Details>
          <p className="mt-4 rounded-lg bg-[var(--gold-soft)] p-3 text-sm font-medium">
            {t.withdrawal.railsNote}
          </p>
        </div>
      </div>

      <SelfServiceStrip doorId="withdrawal529" />

      {FORMATION_MODE ? (
        <FormationNotice kind="withdrawal" />
      ) : (
        <WithdrawalStartForm withdrawalPricing={withdrawalPricing} />
      )}
    </section>
  );
}

function WithdrawalStartForm({ withdrawalPricing }: { withdrawalPricing: WithdrawalPricing }) {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const [parentName, setParentName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Oklahoma City");
  const [childName, setChildName] = useState("");
  const [planChoice, setPlanChoice] = useState<"oklahoma_529" | "oklahomadream_529" | "undecided">("oklahoma_529");
  const [purpose, setPurpose] = useState<WithdrawalPurpose>("college");
  const [plannedAmount, setPlannedAmount] = useState("5000");
  const [targetDate, setTargetDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const start = useMutation({
    mutationFn: () =>
      api.startWithdrawalSitting({
        parentName: parentName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        city: city.trim() || "Oklahoma City",
        childName: childName.trim(),
        planChoice,
        purpose,
        plannedAmount: Number(plannedAmount) || 0,
        targetDate: targetDate.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["public-stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: () => setError(t.withdrawal.formError),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    start.mutate();
  };

  if (start.data) {
    const s = start.data.sitting;
    return (
      <div className="mt-6 rounded-xl border border-[var(--good)] bg-[var(--surface)] p-5" role="status">
        <h3 className="font-display text-xl font-semibold">{t.withdrawal.successTitle} — {s.sittingNumber}</h3>
        <p className="mt-2 text-base">
          {t.withdrawal.successBodyA} <strong>{s.childName}</strong> ({plan529Label(s.planChoice)}).
          {t.withdrawal.successBodyB} <strong>{s.email}</strong> {t.withdrawal.successBodyC}
        </p>
        <p className="mt-2 text-base font-medium">
          {t.withdrawal.successFeeA} ${s.feeAmount} {t.withdrawal.successFeeB}
        </p>
        <button
          type="button"
          className={`${btnGhost} mt-4`}
          onClick={() => start.reset()}
        >
          {t.withdrawal.startAnother}
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
    >
      <h3 className="font-display text-lg font-semibold">{t.withdrawal.formTitle}</h3>
      <p className="mt-1 text-sm text-[var(--dim)]">
        {t.withdrawal.formSub}
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label htmlFor="wd-parent" className={labelCls}>{t.forms.parentName}</label>
          <input id="wd-parent" className={inputCls} value={parentName} onChange={(e) => setParentName(e.target.value)} required autoComplete="name" placeholder="e.g. Maria Gonzalez" />
        </div>
        <div>
          <label htmlFor="wd-email" className={labelCls}>{t.forms.email}</label>
          <input id="wd-email" type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com" />
        </div>
        <div>
          <label htmlFor="wd-phone" className={labelCls}>{t.forms.phoneOpt}</label>
          <input id="wd-phone" type="tel" className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="(405) 555-0100" />
        </div>
        <div>
          <label htmlFor="wd-child" className={labelCls}>{t.forms.childName}</label>
          <input id="wd-child" className={inputCls} value={childName} onChange={(e) => setChildName(e.target.value)} required placeholder="e.g. Sofia Gonzalez" />
        </div>
        <div>
          <label htmlFor="wd-plan" className={labelCls}>{t.forms.plan}</label>
          <select id="wd-plan" className={inputCls} value={planChoice} onChange={(e) => setPlanChoice(e.target.value as typeof planChoice)}>
            <option value="oklahoma_529">{t.forms.planDirect}</option>
            <option value="oklahomadream_529">{t.forms.planAdvisorShort}</option>
            <option value="undecided">{t.forms.planUndecidedShort}</option>
          </select>
        </div>
        <div>
          <label htmlFor="wd-city" className={labelCls}>{t.forms.city}</label>
          <input id="wd-city" className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="wd-purpose" className={labelCls}>{t.withdrawal.purpose}</label>
          <select id="wd-purpose" className={inputCls} value={purpose} onChange={(e) => setPurpose(e.target.value as WithdrawalPurpose)}>
            {WITHDRAWAL_PURPOSE_KEYS.map((key, i) => (
              <option key={key} value={key}>{t.withdrawal.purposes[i] ?? key}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="wd-amount" className={labelCls}>{t.withdrawal.amount}</label>
          <input id="wd-amount" type="number" min={0} max={1000000} className={inputCls} value={plannedAmount} onChange={(e) => setPlannedAmount(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="wd-date" className={labelCls}>{t.withdrawal.date}</label>
          <input id="wd-date" className={inputCls} value={targetDate} onChange={(e) => setTargetDate(e.target.value)} placeholder="e.g. August 2027" />
        </div>
      </div>
      {error ? <p className="mt-4 text-base text-red-700">{error}</p> : null}
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button type="submit" className={btnGold} disabled={start.isPending}>
          {start.isPending ? t.withdrawal.saving : t.withdrawal.submit}
        </button>
        <p className="text-sm text-[var(--dim)]">
          {t.withdrawal.submitNoteA}
        </p>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Membership waitlist form — the subscribe form, parked until the
// membership opens (Founder, 2026-11-11). Saves name and contact only;
// activates nothing. The Center invites people from this list, in order,
// when the membership opens.
// ---------------------------------------------------------------------------

function WaitlistForm() {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Oklahoma City");
  const [tier, setTier] = useState<"" | "starter" | "family" | "family_plus">("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const join = useMutation({
    mutationFn: () =>
      api.joinWaitlist({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        city: city.trim() || "Oklahoma City",
        interestedTier: tier === "" ? undefined : tier,
        note: note.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["public-stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: () => setError(t.waitlist.error),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    join.mutate();
  };

  if (join.data) {
    const { entry, alreadyOnList } = join.data;
    return (
      <div className="rounded-xl border border-[var(--good)] bg-[var(--surface)] p-5" role="status">
        <h3 className="font-display text-xl font-semibold">
          {alreadyOnList ? t.waitlist.successAlready : t.waitlist.successNew}
        </h3>
        <p className="mt-2 text-base">
          {t.waitlist.successBodyA} <strong>{entry.fullName}</strong> {t.waitlist.successBodyB}{" "}
          <strong>#{entry.position}</strong> {t.waitlist.successBodyD} <strong>{entry.email}</strong>{" "}
          {t.waitlist.successBodyE}
        </p>
        <p className="mt-2 text-base">
          {t.waitlist.successNoteA}{" "}
          <a href="#case529" className="font-medium underline"> {t.waitlist.successNoteLink}</a> {t.waitlist.successNoteB}
        </p>
        <button
          type="button"
          className={`${btnGhost} mt-4`}
          onClick={() => join.reset()}
        >
          {t.waitlist.addAnother}
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
    >
      <h3 className="font-display text-lg font-semibold">{t.waitlist.formTitle}</h3>
      <p className="mt-1 text-sm text-[var(--dim)]">
        {t.waitlist.formSub}
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="wl-name" className={labelCls}>{t.forms.fullName}</label>
          <input id="wl-name" className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="name" placeholder="e.g. Maria Gonzalez" />
        </div>
        <div>
          <label htmlFor="wl-email" className={labelCls}>{t.forms.email}</label>
          <input id="wl-email" type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com" />
        </div>
        <div>
          <label htmlFor="wl-phone" className={labelCls}>{t.forms.phoneOpt}</label>
          <input id="wl-phone" type="tel" className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="(405) 555-0100" />
        </div>
        <div>
          <label htmlFor="wl-city" className={labelCls}>{t.forms.city}</label>
          <input id="wl-city" className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="wl-tier" className={labelCls}>{t.forms.tier}</label>
          <select id="wl-tier" className={inputCls} value={tier} onChange={(e) => setTier(e.target.value as typeof tier)}>
            <option value="">{t.forms.tierUndecided}</option>
            {TIER_OPTIONS.map((tier, idx) => (
              <option key={tier.key} value={tier.key}>{t.plans.tiers[idx]?.label ?? tier.label} — ${tier.price} {t.plans.perMonth}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="wl-note" className={labelCls}>{t.forms.note}</label>
          <input id="wl-note" className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.forms.notePlaceholder} />
        </div>
      </div>

      {error ? <p className="mt-4 text-base text-red-700">{error}</p> : null}

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button type="submit" className={btnPrimary} disabled={join.isPending}>
          {join.isPending ? t.waitlist.saving : t.waitlist.submit}
        </button>
        <p className="text-sm text-[var(--dim)]">
          {t.waitlist.submitNote}
        </p>
      </div>
    </form>
  );
}

function SignInForm({ onSignedIn }: { onSignedIn: (email: string, accessKey: string) => void }) {
  const { t } = useLang();
  const [email, setEmail] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const verify = useMutation({
    mutationFn: () =>
      api.getDashboard({ email: email.trim(), accessKey: accessKey.trim() }),
    onSuccess: () => onSignedIn(email.trim(), accessKey.trim()),
    onError: () =>
      setMessage("That email and access key don't match a member account. Check both and try again — or join the waitlist above if the membership hasn't opened for you yet."),
  });
  return (
    <form
      className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
      onSubmit={(e) => {
        e.preventDefault();
        setMessage(null);
        verify.mutate();
      }}
    >
      <h3 className="font-display text-lg font-semibold">{t.signin.title}</h3>
      <p className="mt-1 text-sm text-[var(--dim)]">{t.signin.sub}</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <div className="min-w-64 flex-1">
          <label htmlFor="signin-email" className={labelCls}>{t.signin.email}</label>
          <input id="signin-email" type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
        </div>
        <div className="min-w-64 flex-1">
          <label htmlFor="signin-key" className={labelCls}>{t.signin.key}</label>
          <input id="signin-key" type="password" className={inputCls} value={accessKey} onChange={(e) => setAccessKey(e.target.value)} required placeholder={t.signin.keyPlaceholder} autoComplete="current-password" />
        </div>
        <div className="flex items-end">
          <button type="submit" className={btnGhost} disabled={verify.isPending}>
            {verify.isPending ? t.signin.checking : t.signin.submit}
          </button>
        </div>
      </div>
      {message ? <p className="mt-3 text-sm text-[var(--dim)]">{message}</p> : null}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Member dashboard
// ---------------------------------------------------------------------------

function DashboardView({ data }: { data: Dashboard }) {
  const { member } = data;
  const progressPct = Math.min(100, ((member.referralCount % 10) / 10) * 100);
  return (
    <div className="space-y-6">
      {/* Member card */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          {/* Electronic member card — phone-sized; the QR encodes the
              member number only, for partner-store verification. */}
          <div className="mx-auto w-full max-w-[360px] rounded-2xl bg-[#16294d] p-5 text-white shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <LogoMark className="h-12 w-12 p-1" />
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-widest text-[var(--gold)]">Member Card</p>
                  <p className="font-display mt-1 text-base font-semibold leading-tight">Education Life Center USA</p>
                </div>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                  member.card.status === "active"
                    ? "bg-[var(--gold)] text-[#16294d]"
                    : member.card.status === "lapsed"
                      ? "bg-red-700 text-white"
                      : "bg-white/20 text-white"
                }`}
              >
                {member.card.status.replace(/_/g, " ").toUpperCase()}
              </span>
            </div>
            <div className="mt-5 flex items-end justify-between gap-4">
              <div className="min-w-0">
                <p className="text-white/60 text-sm">Member No.</p>
                <p className="font-mono text-xl font-bold tracking-wider">{member.memberNumber}</p>
                <p className="mt-3 text-white/60 text-sm">Member</p>
                <p className="font-semibold">{member.fullName}</p>
                <p className="mt-3 text-white/60 text-sm">Plan</p>
                <p className="font-semibold">{member.tierLabel} · ${member.monthlyAmount} one time</p>
                {member.card.cardNumber ? (
                  <p className="mt-3 font-mono text-sm tracking-widest text-white/85">{member.card.cardNumber}</p>
                ) : null}
              </div>
              <div className="text-center">
                <QrSvg value={member.memberNumber} size={118} />
                <p className="mt-1.5 text-[11px] leading-tight text-white/70">
                  Show at partner stores
                  <br />
                  for member benefits
                </p>
              </div>
            </div>
          </div>

          {member.status === "awaiting_payment" ? (
            <div className="mx-auto w-full max-w-[360px] rounded-xl border border-[var(--gold)] bg-[var(--gold-soft)] p-4 lg:max-w-none">
              <p className="font-semibold">Your membership application is saved — awaiting bank payment</p>
              {(() => {
                const inv = data.invoices.find((i) => i.status === "awaiting_bank_payment");
                return inv ? (
                  <div className="mt-2 text-base">
                    <p>
                      Pay <strong>${inv.amount}</strong> into the Center's bank account quoting
                      payment reference:
                    </p>
                    <p className="mt-2 font-mono text-2xl font-bold tracking-wide">{inv.paymentReference}</p>
                    <p className="mt-1 text-sm text-[var(--dim)]">
                      Invoice {inv.invoiceNumber} · {inv.periodLabel}
                    </p>
                  </div>
                ) : null;
              })()}
              <p className="mt-3 text-sm text-[var(--dim)]">
                The moment operations confirms your payment, your membership activates
                automatically and this card switches to ACTIVE — no office visit, no extra
                step. Live fee collection starts when the Center's bank account opens at
                formation.
              </p>
            </div>
          ) : null}
        </div>

        {/* Referrals */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 lg:col-span-3">
          <h3 className="font-display text-lg font-semibold">Invite &amp; earn free years</h3>
          <p className="mt-1 text-base text-[var(--dim)]">
            Your referral code:{" "}
            <strong className="text-[var(--text)]">{member.referralCode}</strong> — share it
            with other families. When someone subscribes with your code, the system counts
            them here automatically.
          </p>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-[var(--gold-soft)]" role="progressbar" aria-valuenow={member.referralCount % 10} aria-valuemin={0} aria-valuemax={10} aria-label="Referrals toward your next free year">
            <div className="h-full bg-[var(--gold)]" style={{ width: `${member.referralCount > 0 && member.referralCount % 10 === 0 ? 100 : progressPct}%` }} />
          </div>
          <p className="mt-2 text-sm text-[var(--dim)]">
            {member.referralCount} member(s) subscribed with your code ·{" "}
            {member.freeYearsEarned > 0
              ? `${member.freeYearsEarned} free year(s) earned`
              : `${member.referralsToNextReward} more to your first free year`}
          </p>
          {member.freeYearsEarned > 0 ? (
            <p className="mt-2 rounded-lg bg-[var(--gold-soft)] p-3 text-sm font-medium">
              The system has granted you {member.freeYearsEarned} free year(s) — see the
              $0 reward invoices in your billing list.
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Children */}
        <ChildrenPanel member={member} />

        {/* Billing & fintech payments */}
        <PaymentPanel data={data} />
      </div>

      {/* 529 Access */}
      <Access529Panel data={data} />

      {/* Financial services */}
      <ServiceApplicationsPanel data={data} />

      {/* Job applications */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h3 className="font-display text-lg font-semibold">My job applications (Service 6)</h3>
        {data.jobApplications.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--dim)]">
            You have not applied to any opening yet — browse the Job Promotion board below.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--border)]">
            {data.jobApplications.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div>
                  <p className="font-medium">{j.title}</p>
                  <p className="text-sm text-[var(--dim)]">{j.employerName} · applied {fmtDate(j.createdAt)}</p>
                </div>
                <span className="rounded-full bg-[var(--gold-soft)] px-3 py-1 text-sm font-medium">
                  {statusLabel(j.status)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Automation log / notifications */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h3 className="font-display text-lg font-semibold">Notifications — what the system has done for you</h3>
        <p className="mt-1 text-sm text-[var(--dim)]">
          Every automated step — card issued, application routed, payment confirmed, reward
          granted — notifies you here automatically. No step needs you to call anyone.
        </p>
        {data.events.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--dim)]">No activity yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {data.events.map((e) => (
              <li key={e.id} className="flex gap-3">
                <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--gold)]" aria-hidden="true" />
                <div>
                  <p className="text-base">{e.message}</p>
                  <p className="text-sm text-[var(--dim)]">{fmtDateTime(e.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ChildrenPanel({ member }: { member: Member }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [level, setLevel] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const add = useMutation({
    mutationFn: () =>
      api.addChild({
        memberId: member.id,
        accessKey: storedAccessKey(),
        name: name.trim(),
        birthYear: Number(birthYear) || 2018,
        schoolLevel: level,
      }),
    onSuccess: () => {
      setName("");
      setBirthYear("");
      setLevel("");
      setMsg("Child profile saved — covered free under your membership.");
      queryClient.invalidateQueries({ queryKey: ["dashboard", member.email] });
    },
    onError: () => setMsg("Could not save the child profile. Please try again."),
  });
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h3 className="font-display text-lg font-semibold">Children covered free</h3>
      {member.children.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--dim)]">No children registered yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--border)]">
          {member.children.map((c) => (
            <li key={c.id} className="flex flex-wrap justify-between gap-2 py-2.5">
              <span className="font-medium">{c.name}</span>
              <span className="text-sm text-[var(--dim)]">
                Born {c.birthYear}
                {c.schoolLevel ? ` · ${c.schoolLevel}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
      <form
        className="mt-4 grid gap-3 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          setMsg(null);
          add.mutate();
        }}
      >
        <div>
          <label htmlFor="dash-kid-name" className={labelCls}>Child's name</label>
          <input id="dash-kid-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="dash-kid-year" className={labelCls}>Year of birth</label>
          <input id="dash-kid-year" type="number" min={2008} max={2026} className={inputCls} value={birthYear} onChange={(e) => setBirthYear(e.target.value)} required placeholder="2018" />
        </div>
        <div>
          <label htmlFor="dash-kid-level" className={labelCls}>School level</label>
          <input id="dash-kid-level" className={inputCls} value={level} onChange={(e) => setLevel(e.target.value)} placeholder="Grade 3" />
        </div>
        <div className="sm:col-span-3">
          <button type="submit" className={btnGhost} disabled={add.isPending}>
            {add.isPending ? "Saving…" : "Add child profile"}
          </button>
          {msg ? <p className="mt-2 text-sm text-[var(--dim)]">{msg}</p> : null}
        </div>
      </form>
    </div>
  );
}

const OK529_ABOUT_URL = "https://www.oklahoma529.com/why/about/";
const OK529_HOW_URL = "https://www.oklahoma529.com/learn/how-does-a-529-plan-work/";
const OK529_OPEN_URL = "https://www.oklahoma529.com/open/";

function plan529Label(choice: string): string {
  if (choice === "oklahoma_529") return "Oklahoma 529 — direct state plan";
  if (choice === "oklahomadream_529") return "OklahomaDream 529 — advisor-sold state plan";
  return "Still choosing — guidance requested";
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

// ---------------------------------------------------------------------------
// 529 Access — public section
// ---------------------------------------------------------------------------

function Access529Section({
  isMember,
  casePricing,
}: {
  isMember: boolean;
  casePricing: CasePricing;
}) {
  const { t } = useLang();
  const [monthly, setMonthly] = useState(100);
  const [years, setYears] = useState(10);
  const [alreadySaved, setAlreadySaved] = useState(0);
  const contributed = monthly * 12 * years;
  const projectedContributions = alreadySaved + contributed;
  // Reference yardstick from the OKC research discussed with the Founder:
  // an Oklahoma public university costs roughly $22,600 a year all-in, so
  // four years is roughly $90,400. Costs change — this is an estimate only.
  const fourYearEstimate = 90400;
  const pctOfEstimate = Math.min(
    100,
    Math.round((projectedContributions / fourYearEstimate) * 100),
  );

  return (
    <section id="access529" aria-label="529 Access" className="py-10">
      <SectionWithLogo logoClassName="h-16 w-16 sm:h-20 sm:w-20" sub={`${t.access.subA} $${casePricing.nextCaseFee}${t.access.subB}`}>
        {t.access.title}
      </SectionWithLogo>

      <p className="mb-5 max-w-3xl text-lg text-[var(--dim)]">
        {t.access.intro}
      </p>

      <article className="mb-5 rounded-xl border border-[var(--gold)] bg-[var(--gold-soft)] p-5">
        <h3 className="font-display text-xl font-semibold">{t.access.anyoneTitle}</h3>
        <p className="mt-2 max-w-3xl text-base">{t.access.anyoneBody}</p>
        <ul className="mt-3 grid gap-2 text-base font-medium sm:grid-cols-3">
          <li>• {t.access.anyoneP1}</li>
          <li>• {t.access.anyoneP2}</li>
          <li>• {t.access.anyoneP3}</li>
        </ul>
      </article>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--gold)]">
            {t.access.directKicker}
          </p>
          <h3 className="font-display mt-1 text-xl font-semibold">Oklahoma 529</h3>
          <p className="mt-2 text-base text-[var(--dim)]">
            {t.access.directBody}
          </p>
          <Details summary={t.access.aboutPlan}>
            <p className="text-base text-[var(--dim)]">
              {t.access.directAbout}
            </p>
          </Details>
          <div className="mt-4 flex flex-wrap gap-3">
            <a href={OK529_OPEN_URL} target="_blank" rel="noreferrer" className={btnPrimary}>
              {t.access.openOfficial}
            </a>
            <a href={OK529_HOW_URL} target="_blank" rel="noreferrer" className={btnGhost}>
              {t.access.howWorks}
            </a>
          </div>
          <p className="mt-3 text-sm text-[var(--dim)]">
            {t.access.source}{" "}
            <a href={OK529_ABOUT_URL} target="_blank" rel="noreferrer" className="underline">
              {t.access.sourceLink}
            </a>
          </p>
        </article>

        <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--gold)]">
            {t.access.advisorKicker}
          </p>
          <h3 className="font-display mt-1 text-xl font-semibold">OklahomaDream 529</h3>
          <p className="mt-2 text-base text-[var(--dim)]">
            {t.access.advisorBody}
          </p>
          <Details summary={t.access.aboutPlan}>
            <p className="text-base text-[var(--dim)]">
              {t.access.advisorAbout}
            </p>
          </Details>
          <p className="mt-4 rounded-lg bg-[var(--gold-soft)] p-3 text-sm font-medium">
            {t.access.advisorFeeNote}
          </p>
        </article>
      </div>

      <Details summary={t.access.stepsSummary}>
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {t.access.steps.map((s, i) => (
          <li key={i} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <span className="font-display flex h-9 w-9 items-center justify-center rounded-full bg-[var(--gold-soft)] text-lg font-bold text-[var(--gold)]">
              {i + 1}
            </span>
            <h3 className="mt-3 font-semibold">{s.t}</h3>
            <p className="mt-1 text-sm text-[var(--dim)]">{s.d}</p>
          </li>
        ))}
      </ol>
      </Details>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h3 className="font-display text-lg font-semibold">{t.access.calcTitle}</h3>
          <p className="mt-1 text-sm text-[var(--dim)]">
            {t.access.calcSub}
          </p>
          <Details summary={t.access.calcOpen}>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="calc-monthly" className={labelCls}>{t.access.calcMonthly}</label>
              <input
                id="calc-monthly"
                type="number"
                min={0}
                max={10000}
                className={inputCls}
                value={monthly}
                onChange={(e) => setMonthly(Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <label htmlFor="calc-years" className={labelCls}>{t.access.calcYears}</label>
              <input
                id="calc-years"
                type="number"
                min={0}
                max={25}
                className={inputCls}
                value={years}
                onChange={(e) => setYears(Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <label htmlFor="calc-saved" className={labelCls}>{t.access.calcSaved}</label>
              <input
                id="calc-saved"
                type="number"
                min={0}
                max={1000000}
                className={inputCls}
                value={alreadySaved}
                onChange={(e) => setAlreadySaved(Number(e.target.value) || 0)}
              />
            </div>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-[var(--gold-soft)]" role="progressbar" aria-valuenow={pctOfEstimate} aria-valuemin={0} aria-valuemax={100} aria-label="Share of a four-year Oklahoma public university cost covered by contributions alone">
            <div className="h-full bg-[var(--gold)]" style={{ width: `${pctOfEstimate}%` }} />
          </div>
          <p className="mt-2 text-base">
            <strong>{money(projectedContributions)}</strong> {t.access.calcResultA}{" "}
            {years} {t.access.calcResultB} <strong>{pctOfEstimate}%</strong> {t.access.calcResultC} ({money(fourYearEstimate)})
          </p>
          </Details>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--gold-soft)] p-5">
          <h3 className="font-display text-lg font-semibold">{t.access.linesTitle}</h3>
          <p className="mt-2 text-base">
            {t.access.linesLead}
          </p>
          <Details summary={t.access.linesSummary}>
          <ul className="list-disc space-y-2 pl-5 text-base">
            {t.access.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          </Details>
          <div className="mt-4">
            {isMember ? (
              <a href="#dashboard" className={btnPrimary}>{t.access.ctaDashboard}</a>
            ) : (
              <a href="#case529" className={btnPrimary}>{t.access.ctaCase} — ${casePricing.nextCaseFee} {t.hero.ctaCaseSuffix}</a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 529 Access — member dashboard panel
// ---------------------------------------------------------------------------

function Access529Panel({ data }: { data: Dashboard }) {
  const queryClient = useQueryClient();
  const member = data.member;
  const plans = data.plans529;
  const [childName, setChildName] = useState("");
  const [planChoice, setPlanChoice] = useState<"oklahoma_529" | "oklahomadream_529" | "undecided">("oklahoma_529");
  const [goalAmount, setGoalAmount] = useState("25000");
  const [monthlyContribution, setMonthlyContribution] = useState("100");
  const [currentSaved, setCurrentSaved] = useState("0");
  const [targetYear, setTargetYear] = useState("2036");
  const [remindersOn, setRemindersOn] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [savedInputs, setSavedInputs] = useState<Record<number, string>>({});

  const create = useMutation({
    mutationFn: () =>
      api.setup529Plan({
        memberId: member.id,
        accessKey: storedAccessKey(),
        childName: childName.trim(),
        planChoice,
        goalAmount: Number(goalAmount) || 0,
        monthlyContribution: Number(monthlyContribution) || 0,
        currentSaved: Number(currentSaved) || 0,
        targetYear: Number(targetYear) || 2040,
        remindersOn,
      }),
    onSuccess: () => {
      setMsg("529 Access goal saved. Next step: open the account yourself on the state plan's official site, then come back and mark it opened below. Your money goes directly to the state plan — never through the Center.");
      setChildName("");
      queryClient.invalidateQueries({ queryKey: ["dashboard", member.email] });
      queryClient.invalidateQueries({ queryKey: ["public-stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: () => setMsg("Could not save that 529 goal. Please check the form and try again."),
  });

  const update = useMutation({
    mutationFn: (args: {
      planId: number;
      currentSaved?: number;
      status?: "planning" | "guidance_requested" | "account_opened" | "tracking";
      remindersOn?: boolean;
    }) => api.update529Plan({ memberId: member.id, accessKey: storedAccessKey(), ...args }),
    onSuccess: () => {
      setMsg("Your 529 Access goal is updated — the change is in your activity log below.");
      queryClient.invalidateQueries({ queryKey: ["dashboard", member.email] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: () => setMsg("Could not update that goal. Please try again."),
  });

  const nowYear = new Date().getFullYear();

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <LogoMark className="h-12 w-12" />
          <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold">529 Access — college savings, guided &amp; tracked</h3>
          <p className="mt-1 max-w-3xl text-base text-[var(--dim)]">
            Set a goal for each child, open the account yourself on Oklahoma's state
            plan site, and track it here. The Center guides and reminds — it never holds
            529 money and never advises on investments.
          </p>
          </div>
        </div>
        <a href={OK529_OPEN_URL} target="_blank" rel="noreferrer" className={btnGold}>
          Open Oklahoma 529 (official site)
        </a>
      </div>

      {plans.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--dim)]">
          No 529 goals yet — create your first one with the form below. It takes a
          minute, and you can change every number later.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {plans.map((p) => {
            const pct = p.goalAmount > 0 ? Math.min(100, Math.round((p.currentSaved / p.goalAmount) * 100)) : 0;
            const monthsLeft = Math.max(0, (p.targetYear - nowYear) * 12);
            const projected = p.currentSaved + p.monthlyContribution * monthsLeft;
            return (
              <li key={p.id} className="rounded-lg border border-[var(--border)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">
                    {p.childName} <span className="font-normal text-[var(--dim)]">· {plan529Label(p.planChoice)}</span>
                  </p>
                  <span className="rounded-full bg-[var(--gold-soft)] px-3 py-1 text-sm font-medium">
                    {statusLabel(p.status)}
                  </span>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-[var(--gold-soft)]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Progress toward the 529 goal for ${p.childName}`}>
                  <div className="h-full bg-[var(--gold)]" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-2 text-sm text-[var(--dim)]">
                  {money(p.currentSaved)} saved of {money(p.goalAmount)} goal ({pct}%) ·
                  {" "}{money(p.monthlyContribution)}/month planned · target {p.targetYear} ·
                  {" "}at this pace, contributions alone reach about {money(projected)} by {p.targetYear} (no growth assumed) ·
                  {" "}reminders {p.remindersOn ? "ON" : "OFF"}
                </p>
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <div>
                    <label htmlFor={`saved-${p.id}`} className={labelCls}>Update amount saved ($)</label>
                    <input
                      id={`saved-${p.id}`}
                      type="number"
                      min={0}
                      max={1000000}
                      className={inputCls}
                      value={savedInputs[p.id] ?? String(p.currentSaved)}
                      onChange={(e) => setSavedInputs((s) => ({ ...s, [p.id]: e.target.value }))}
                    />
                  </div>
                  <button
                    type="button"
                    className={btnGhost}
                    disabled={update.isPending}
                    onClick={() =>
                      update.mutate({
                        planId: p.id,
                        currentSaved: Number(savedInputs[p.id] ?? p.currentSaved) || 0,
                        status: p.status === "account_opened" || p.status === "tracking" ? "tracking" : undefined,
                      })
                    }
                  >
                    Save amount
                  </button>
                  {p.status !== "account_opened" && p.status !== "tracking" ? (
                    <button
                      type="button"
                      className={btnPrimary}
                      disabled={update.isPending}
                      onClick={() => update.mutate({ planId: p.id, status: "account_opened" })}
                    >
                      I opened the state-plan account
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={btnGhost}
                    disabled={update.isPending}
                    onClick={() => update.mutate({ planId: p.id, remindersOn: !p.remindersOn })}
                  >
                    {p.remindersOn ? "Turn reminders off" : "Turn reminders on"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form
        className="mt-5 grid gap-4 border-t border-[var(--border)] pt-5 sm:grid-cols-2 lg:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          setMsg(null);
          create.mutate();
        }}
      >
        <div>
          <label htmlFor="p529-child" className={labelCls}>Child's name</label>
          <input
            id="p529-child"
            className={inputCls}
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            required
            placeholder={member.children[0]?.name ?? "e.g. Sofia Gonzalez"}
            list="p529-children"
          />
          <datalist id="p529-children">
            {member.children.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
        </div>
        <div>
          <label htmlFor="p529-plan" className={labelCls}>State 529 plan</label>
          <select id="p529-plan" className={inputCls} value={planChoice} onChange={(e) => setPlanChoice(e.target.value as typeof planChoice)}>
            <option value="oklahoma_529">Oklahoma 529 — direct</option>
            <option value="oklahomadream_529">OklahomaDream 529 — advisor-sold</option>
            <option value="undecided">Still choosing — guide me</option>
          </select>
        </div>
        <div>
          <label htmlFor="p529-target" className={labelCls}>College start year</label>
          <input id="p529-target" type="number" min={2026} max={2060} className={inputCls} value={targetYear} onChange={(e) => setTargetYear(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="p529-goal" className={labelCls}>Savings goal ($)</label>
          <input id="p529-goal" type="number" min={0} max={1000000} className={inputCls} value={goalAmount} onChange={(e) => setGoalAmount(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="p529-monthly" className={labelCls}>Monthly contribution ($)</label>
          <input id="p529-monthly" type="number" min={0} max={100000} className={inputCls} value={monthlyContribution} onChange={(e) => setMonthlyContribution(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="p529-saved" className={labelCls}>Already saved ($)</label>
          <input id="p529-saved" type="number" min={0} max={1000000} className={inputCls} value={currentSaved} onChange={(e) => setCurrentSaved(e.target.value)} required />
        </div>
        <div className="flex items-end pb-1">
          <label className="flex min-h-8 cursor-pointer items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={remindersOn} onChange={(e) => setRemindersOn(e.target.checked)} className="h-5 w-5" />
            Contribution reminders — the system reminds me to keep saving
          </label>
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <button type="submit" className={btnPrimary} disabled={create.isPending}>
            {create.isPending ? "Saving…" : "Create my 529 Access goal"}
          </button>
          <p className="mt-2 text-sm text-[var(--dim)]">
            General education only — the Center does not recommend a portfolio for your
            family. Read the plan description on the official site before opening an
            account, and talk to a licensed advisor or tax professional for personal
            advice.
          </p>
          {msg ? <p className="mt-3 text-base font-medium">{msg}</p> : null}
        </div>
      </form>
    </div>
  );
}

function ServiceApplicationsPanel({ data }: { data: Dashboard }) {
  const queryClient = useQueryClient();
  const member = data.member;
  // Term Advance (Service 5) is parked at start — only Family Credit
  // Support (Service 7) takes applications.
  const service = "family_credit" as const;
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [detail, setDetail] = useState("");
  const [household, setHousehold] = useState("");
  const [consent, setConsent] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const apply = useMutation({
    mutationFn: () =>
      api.applyService({
        memberId: member.id,
        accessKey: storedAccessKey(),
        service,
        amount: Number(amount),
        purpose: purpose.trim(),
        detail: [
          detail.trim(),
          household.trim() !== "" ? `Household: ${household.trim()} people.` : "",
          "Partner-bank consent: YES — I agree the Center may pass this application and my contact details to a partner bank or credit union, which reviews it and decides. The Center never lends and never guarantees approval.",
        ]
          .filter((s) => s !== "")
          .join(" "),
      }),
    onSuccess: (res) => {
      setMsg(`Application saved and routed automatically to ${res.partner}. Watch its status below — the partner institution reviews it and decides.`);
      setAmount("");
      setPurpose("");
      setDetail("");
      setHousehold("");
      setConsent(false);
      queryClient.invalidateQueries({ queryKey: ["dashboard", member.email] });
      queryClient.invalidateQueries({ queryKey: ["public-stats"] });
    },
    onError: () => setMsg("Could not save the application. Please check the amount and purpose and try again."),
  });

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h3 className="font-display text-lg font-semibold">
        Family Credit Support (Service 7)
      </h3>
      <p className="mt-1 text-base text-[var(--dim)]">
        One application inside your dashboard, for an education-related need. The system
        checks it and routes it to a partner bank or credit union; the partner reviews and
        decides, and the decision is recorded here. The Center never lends directly and
        never guarantees approval — the partner bank decides. Term Advance (Service 5) is
        built into the system but opens later — it is not taking applications yet.
      </p>

      <form
        className="mt-4 grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          setMsg(null);
          apply.mutate();
        }}
      >
        <div>
          <span className={labelCls}>Service</span>
          <p className="rounded-lg border border-[var(--border)] bg-[var(--gold-soft)] px-3 py-2 text-base font-medium">
            Service 7 — Family Credit Support
          </p>
          <p className="mt-1 text-sm text-[var(--dim)]">
            Service 5 — Term Advance: coming later, not open yet.
          </p>
        </div>
        <div>
          <label htmlFor="app-amount" className={labelCls}>Amount requested (USD)</label>
          <input id="app-amount" type="number" min={50} max={1000000} step="1" className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="e.g. 1200" />
        </div>
        <div>
          <label htmlFor="app-purpose" className={labelCls}>Purpose</label>
          <input id="app-purpose" className={inputCls} value={purpose} onChange={(e) => setPurpose(e.target.value)} required placeholder="e.g. Fall term tuition and books" />
        </div>
        <div>
          <label htmlFor="app-detail" className={labelCls}>Anything the partner should know (optional)</label>
          <input id="app-detail" className={inputCls} value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Employment, timing, other details" />
        </div>
        <div>
          <label htmlFor="app-household" className={labelCls}>Household size (people)</label>
          <input id="app-household" type="number" min={1} max={30} step="1" className={inputCls} value={household} onChange={(e) => setHousehold(e.target.value)} placeholder="e.g. 4" />
        </div>
        <div className="flex items-end pb-1">
          <label className="flex min-h-8 cursor-pointer items-start gap-2 text-sm font-medium">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0" required />
            I agree the Center may pass this application and my contact details to a partner
            bank or credit union for referral. The partner decides; the Center never lends
            and never guarantees approval.
          </label>
        </div>
        <div className="sm:col-span-2">
          <button type="submit" className={btnPrimary} disabled={apply.isPending || !consent}>
            {apply.isPending ? "Routing…" : "Submit — route my application automatically"}
          </button>
          {msg ? <p className="mt-3 text-base">{msg}</p> : null}
        </div>
      </form>

      {data.applications.length > 0 ? (
        <ul className="mt-5 divide-y divide-[var(--border)]">
          {data.applications.map((a) => (
            <li key={a.id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">
                  {a.service === "term_advance" ? "Term Advance" : "Family Credit Support"}
                  {a.amount != null ? ` — $${a.amount.toLocaleString("en-US")}` : ""}
                </p>
                <span className="rounded-full bg-[var(--gold-soft)] px-3 py-1 text-sm font-medium">
                  {statusLabel(a.status)}
                </span>
              </div>
              <p className="mt-1 text-sm text-[var(--dim)]">
                {a.purpose} · routed to {a.partner} · {fmtDate(a.createdAt)}
              </p>
              {a.decision ? <p className="mt-1 text-sm">Partner decision: {a.decision}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Job Promotion board
// ---------------------------------------------------------------------------

// PUBLIC PREVIEW (Founder, 2026-11-13; upgraded 2026-11-20): six verified
// Oklahoma City openings are shown to everyone as an "open jobs" preview
// of Job Promotion. These six are hard-coded public content with their
// official application links (verified 2026-11-20); the full board of 15
// stays members-only behind the lock in JobsSection, and no other listing
// is exposed here.
const PREVIEW_APPLY_URLS = [
  "https://oklahomadepartmentofhumanservices.applytojob.com/apply/iYbEhBGbDm/Case-Manager-III-Hiring-Event-12082026-OKC",
  "https://oklahomadepartmentofhumanservices.applytojob.com/apply/Y9RPRP7NGj/Family-Services-Specialist-III-PART-TIME",
  "https://careers.hobbylobby.com/current-openings/distribution",
  "https://www.usajobs.gov/job/891447700",
  "https://oklahomadepartmentofhumanservices.applytojob.com/apply/aOw2iJpftt/Child-Support-Specialist-III",
  "https://okgov.wd1.myworkdayjobs.com/en-US/okgovjobs/details/Communication-and-Education-Supervisor_JR67818",
];

function JobsPreviewSection() {
  const { t } = useLang();
  return (
    <section id="jobs-preview" aria-label={t.jobs.preview.title} className="py-10">
      <SectionWithLogo sub={t.jobs.preview.sub}>
        {t.jobs.preview.title}
      </SectionWithLogo>
      <div className="grid gap-4 md:grid-cols-3">
        {t.jobs.preview.items.map((job, i) => (
          <article key={job.title} className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h3 className="font-display text-xl font-semibold">{job.title}</h3>
            <p className="text-sm text-[var(--dim)]">
              {job.employer} · {job.location}
            </p>
            <p className="mt-2 text-base font-bold text-red-700">{job.deadline}</p>
            <p className="mt-2 text-base font-medium">{job.pay}</p>
            <p className="mt-2 text-base text-[var(--dim)]">{job.detail}</p>
            <p className="mt-2 text-sm text-[var(--dim)]">
              {t.jobs.verifiedLine.replace("{date}", fmtDate("2026-11-20T12:00:00"))}
            </p>
            <div className="mt-auto pt-4">
              <a href={PREVIEW_APPLY_URLS[i] ?? "#"} target="_blank" rel="noreferrer" className={btnPrimary}>
                {t.jobs.applyOfficial}
              </a>
            </div>
          </article>
        ))}
      </div>
      <p className="mt-4 max-w-3xl text-base text-[var(--dim)]">{t.jobs.preview.membersNote}</p>
    </section>
  );
}


function JobsSection({ memberId, memberEmail }: { memberId: number | null; memberEmail: string | null }) {
  const { t } = useLang();
  const queryClient = useQueryClient();
  // MEMBERS ONLY (Founder, 2026-11-13): the open-jobs list is reachable
  // only after member sign-in with the personal access key. A signed-out
  // visitor sees the locked panel and the waitlist door — the listings
  // are not even fetched.
  const signedIn = memberId != null;
  const jobs = useQuery({
    queryKey: ["jobs", memberEmail],
    queryFn: () =>
      api.listJobs({ limit: 50, email: memberEmail ?? "", accessKey: storedAccessKey() }),
    enabled: signedIn && memberEmail != null,
  });
  const [applyMsg, setApplyMsg] = useState<string | null>(null);
  const apply = useMutation({
    mutationFn: (listing: Listing) =>
      api.applyJob({ memberId: memberId ?? 0, accessKey: storedAccessKey(), listingId: listing.id, note: "" }),
    onSuccess: (_res, listing) => {
      setApplyMsg(
        listing.applyUrl !== ""
          ? `${t.jobs.recorded} ${listing.title} — ${listing.employerName}.`
          : `Applied — the system forwarded your application to ${listing.employerName} automatically. Track it on your dashboard.`,
      );
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => setApplyMsg("Could not send that application. Please try again."),
  });

  return (
    <section id="jobs" aria-label={t.jobs.title} className="py-10">
      <SectionWithLogo sub={t.jobs.sub}>
        {t.jobs.title}
      </SectionWithLogo>
      {!signedIn ? (
        <div className="max-w-xl rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="font-display text-xl font-semibold">{t.jobs.lockedTitle}</p>
          <p className="mt-2 text-base text-[var(--dim)]">{t.jobs.lockedBody}</p>
          <a href="#subscribe" className={`${btnPrimary} mt-4`}>
            {t.jobs.lockedCta}
          </a>
        </div>
      ) : (
        <>
          {applyMsg ? (
            <p className="mb-4 rounded-xl border border-[var(--good)] bg-[var(--surface)] p-4 text-base">{applyMsg}</p>
          ) : null}
          {jobs.isPending ? <p className="text-[var(--dim)]">{t.jobs.loading}</p> : null}
          {jobs.data && jobs.data.listings.length === 0 ? (
            <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-base text-[var(--dim)]">
              {t.jobs.empty}
            </p>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            {jobs.data?.listings.map((job) => (
              <article key={job.id} className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-display text-xl font-semibold">{job.title}</h3>
                    <p className="text-sm text-[var(--dim)]">
                      {job.employerName} · {job.location}
                    </p>
                  </div>
                  <span className="rounded-full bg-[var(--gold-soft)] px-3 py-1 text-sm font-medium">
                    {job.applicationCount} {t.jobs.applied}
                  </span>
                </div>
                <p className="mt-2 text-base font-medium">
                  {job.payRange ? job.payRange : ""}
                  {job.employmentType ? (
                    <span className="text-[var(--dim)]">{job.payRange ? " · " : ""}{job.employmentType}</span>
                  ) : null}
                </p>
                {job.requirements ? (
                  <p className="mt-2 text-base text-[var(--dim)]">
                    <span className="font-medium text-[var(--text)]">{t.jobs.requirements}: </span>
                    {job.requirements}
                  </p>
                ) : null}
                {job.description && job.description !== job.requirements ? (
                  <p className="mt-2 text-base text-[var(--dim)]">{job.description}</p>
                ) : null}
                {job.deadline ? (
                  <p className="mt-2 text-sm font-semibold text-red-700">
                    {t.jobs.deadline}: {job.deadline}
                  </p>
                ) : null}
                {job.verifiedDate ? (
                  <p className="mt-2 text-sm text-[var(--dim)]">
                    {t.jobs.verifiedLine.replace("{date}", fmtDate(job.verifiedDate.length === 10 ? `${job.verifiedDate}T12:00:00` : job.verifiedDate))}
                  </p>
                ) : null}
                <div className="mt-auto flex flex-wrap items-center gap-3 pt-4">
                  {job.applyUrl ? (
                    <>
                      <a href={job.applyUrl} target="_blank" rel="noreferrer" className={btnPrimary}>
                        {t.jobs.applyOfficial}
                      </a>
                      <button
                        type="button"
                        className={btnGhost}
                        disabled={apply.isPending}
                        onClick={() => apply.mutate(job)}
                      >
                        {t.jobs.recordApplied}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className={btnPrimary}
                      disabled={apply.isPending}
                      onClick={() => apply.mutate(job)}
                    >
                      {t.jobs.apply}
                    </button>
                  )}
                </div>
                {!job.verifiedDate ? (
                  <p className="mt-2 text-sm text-[var(--dim)]">{t.jobs.posted} {fmtDate(job.createdAt)}</p>
                ) : null}
              </article>
            ))}
          </div>
        </>
      )}
      <Details summary={t.jobs.postSummary}>
        <PostJobForm />
      </Details>
    </section>
  );
}

function PostJobForm() {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const [employerName, setEmployerName] = useState("");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("Oklahoma City, OK");
  const [payRange, setPayRange] = useState("");
  const [description, setDescription] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const post = useMutation({
    mutationFn: () =>
      api.postJob({ employerName, title, location, payRange, description, contactEmail }),
    onSuccess: () => {
      setMsg("Your opening is live on the board — members can apply now, and every application is forwarded to you automatically.");
      setEmployerName("");
      setTitle("");
      setPayRange("");
      setDescription("");
      setContactEmail("");
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["public-stats"] });
    },
    onError: () => setMsg("Could not post the opening. Please check the form and try again."),
  });

  return (
    <form
      className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        post.mutate();
      }}
    >
      <h3 className="font-display text-lg font-semibold">{t.jobs.formTitle}</h3>
      <p className="mt-1 text-sm text-[var(--dim)]">
        {t.jobs.formSub}
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="job-employer" className={labelCls}>{t.jobs.employer}</label>
          <input id="job-employer" className={inputCls} value={employerName} onChange={(e) => setEmployerName(e.target.value)} required placeholder="e.g. OKC Community Clinic" />
        </div>
        <div>
          <label htmlFor="job-title" className={labelCls}>{t.jobs.jobTitle}</label>
          <input id="job-title" className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. Front desk assistant" />
        </div>
        <div>
          <label htmlFor="job-location" className={labelCls}>{t.jobs.location}</label>
          <input id="job-location" className={inputCls} value={location} onChange={(e) => setLocation(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="job-pay" className={labelCls}>{t.jobs.pay}</label>
          <input id="job-pay" className={inputCls} value={payRange} onChange={(e) => setPayRange(e.target.value)} placeholder="e.g. $15–18/hr" />
        </div>
        <div>
          <label htmlFor="job-email" className={labelCls}>{t.jobs.contactEmail}</label>
          <input id="job-email" type="email" className={inputCls} value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} required placeholder="hiring@example.com" />
        </div>
        <div>
          <label htmlFor="job-desc" className={labelCls}>{t.jobs.desc}</label>
          <input id="job-desc" className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t.jobs.descPlaceholder} />
        </div>
      </div>
      <div className="mt-5">
        <button type="submit" className={btnGold} disabled={post.isPending}>
          {post.isPending ? t.jobs.posting : t.jobs.postSubmit}
        </button>
        {msg ? <p className="mt-3 text-base">{msg}</p> : null}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Center operations (admin)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Self-service doors, journey tracking, and the AI assistant (Founder,
// 2026-11-12). Every door links to the OFFICIAL website, where the family
// registers themselves — this site never asks for or stores an
// official-site password. The journey tracks three states per door (not
// started / went to the official site / completed — reported by the
// family), generates email reports after every step, and shows the
// family's numbers (JOURNEY-####, CASE529-####, WDRAW-####) in one
// dashboard. A reported completion of a guided-tier door makes the flat
// $25 navigation success fee due; pointer doors carry no fee.
// ---------------------------------------------------------------------------

type JourneyResponse = ApiResponse<typeof api, "getJourney">;
type JourneyViewData = NonNullable<JourneyResponse["view"]>;
type DoorIdParam = ApiRequest<typeof api, "recordDoorVisit">["doorId"];

// Official websites only — every URL was copied verbatim from the
// official programme's own pages or search-verified official sources
// (see DATA-PLAN). Families register on these sites themselves.
const DOOR_CATALOG: { id: DoorIdParam; name: string; url: string }[] = [
  { id: "ok529", name: "Oklahoma 529 — open an account", url: "https://www.oklahoma529.com/open/" },
  { id: "withdrawal529", name: "Oklahoma 529 — request a withdrawal", url: "https://www.oklahoma529.com/resources/faq/" },
  { id: "fafsa_pell", name: "FAFSA — Federal Pell Grant & federal aid", url: "https://studentaid.gov/h/apply-for-aid/fafsa" },
  { id: "ok_promise", name: "Oklahoma's Promise", url: "https://okpromise.org/" },
  { id: "pctc", name: "Parental Choice Tax Credit (OkTAP)", url: "https://oklahoma.gov/tax/individuals/parental-choice-tax-credit.html" },
  { id: "child_care", name: "Child Care Subsidy — OKDHSLive", url: "https://okdhslive.org" },
  { id: "va_dea_fry", name: "VA Education Benefits — Chapter 35 & Fry Scholarship", url: "https://www.va.gov/family-and-caregiver-benefits/education-and-careers/apply-for-dea-fry-form-22-5490/introduction" },
  { id: "inspired_teach", name: "Inspired to Teach (Oklahoma Future Teachers)", url: "https://okhighered.org/state-system/overview-part3/" },
  { id: "concurrent", name: "Concurrent Enrollment Tuition Waiver", url: "https://okhighered.org/state-system/overview-part3/" },
  { id: "foster_waiver", name: "Foster Care Tuition Waiver (Independent Living Act)", url: "https://okhighered.org/state-system/overview-part3/" },
  { id: "nat_guard", name: "Oklahoma National Guard Educational Assistance (EAP)", url: "https://ok.ng.mil/oked/" },
  { id: "cherokee", name: "Cherokee Nation — College Resource Center (Gadugi Portal)", url: "https://gadugiportal.cherokee.org/" },
  { id: "choctaw", name: "Choctaw Nation — Higher Education Program", url: "https://www.choctawnation.com/services/higher-education/" },
  { id: "chickasaw", name: "Chickasaw Nation — Student Support & Education", url: "https://chickasaw.net/StudentSupport" },
  { id: "muscogee", name: "Muscogee Nation — Higher Education (Camphouse Portal)", url: "https://www.muscogeenation.com/det/he/" },
  { id: "osage", name: "Osage Nation — Higher Education Scholarship", url: "https://www.osagenation-nsn.gov/services/education-department/higher-education-scholarship" },
  { id: "fseog", name: "Federal Supplemental Educational Opportunity Grant (FSEOG)", url: "https://studentaid.gov/h/apply-for-aid/fafsa" },
  { id: "work_study", name: "Federal Work-Study", url: "https://studentaid.gov/h/apply-for-aid/fafsa" },
  { id: "otag", name: "Oklahoma Tuition Aid Grant (OTAG)", url: "https://studentaid.gov/h/apply-for-aid/fafsa" },
  { id: "oteg", name: "Oklahoma Tuition Equalization Grant (OTEG)", url: "https://studentaid.gov/h/apply-for-aid/fafsa" },
  { id: "aotc", name: "American Opportunity Tax Credit (AOTC)", url: "https://www.irs.gov/newsroom/tax-benefits-for-education-information-center" },
  { id: "llc", name: "Lifetime Learning Credit (LLC)", url: "https://www.irs.gov/newsroom/tax-benefits-for-education-information-center" },
  { id: "rising_scholars", name: "Oklahoma Rising Scholars Award", url: "https://okhighered.org/state-system/overview-part3/" },
  { id: "reach_higher", name: "Reach Higher — Finish Line Scholarships for Adults", url: "https://reachhigherok.org/adult-scholarships/" },
  { id: "careertech", name: "CareerTech Financial Aid", url: "https://studentaid.gov/h/apply-for-aid/fafsa" },
  { id: "able", name: "Oklahoma ABLE (OK STABLE) Account", url: "https://oklahoma.gov/treasurer/ok-able-plan.html" },
];

const GUIDED_DOOR_IDS: DoorIdParam[] = [
  "ok529", "withdrawal529", "fafsa_pell", "ok_promise", "pctc", "child_care",
  "va_dea_fry", "inspired_teach", "concurrent", "foster_waiver", "nat_guard",
  "cherokee", "choctaw", "chickasaw", "muscogee", "osage",
];
const POINTER_DOOR_IDS: DoorIdParam[] = [
  "fseog", "work_study", "otag", "oteg", "aotc", "llc",
  "rising_scholars", "reach_higher", "careertech", "able",
];

function storedJourneyValue(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

// The self-service strip inside the case door and withdrawal sections:
// the same door, done by the family themselves on the official site,
// with the $25 navigation fee disclosed before the click-out.
function SelfServiceStrip({ doorId }: { doorId: "ok529" | "withdrawal529" }) {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const door = DOOR_CATALOG.find((d) => d.id === doorId);
  const item = t.doors.items[doorId];
  const visit = useMutation({
    mutationFn: () =>
      api.recordDoorVisit({
        email: storedJourneyValue("elc-journey-email"),
        name: storedJourneyValue("elc-journey-name"),
        doorId,
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["journey"] }),
  });
  if (!door || !item) return null;
  return (
    <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-[var(--gold)]">
        {t.doors.guidedBadge} · {t.doors.title}
      </p>
      <p className="mt-2 text-base text-[var(--dim)]">{item.pays}</p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-[var(--dim)]">
        {item.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <p className="mt-3 rounded-lg bg-[var(--gold-soft)] p-3 text-sm font-medium">
        {t.doors.feeLine}
      </p>
      <a
        href={door.url}
        target="_blank"
        rel="noreferrer"
        className={`${btnGold} mt-3`}
        onClick={() => {
          if (storedJourneyValue("elc-journey-email").includes("@")) visit.mutate();
        }}
      >
        {t.doors.registerBtn} ↗
      </a>
    </div>
  );
}

function DoorStatusChip({ door, view }: { door: { id: DoorIdParam }; view: JourneyViewData | null }) {
  const { t } = useLang();
  const p = view?.doors.find((d) => d.doorId === door.id) ?? null;
  if (!p || p.status === "not_started") {
    return (
      <span className="inline-block rounded-full border border-[var(--border)] px-2.5 py-0.5 text-xs font-medium text-[var(--dim)]">
        {t.journey.statusNotStarted}
      </span>
    );
  }
  if (p.status === "visited") {
    return (
      <span className="inline-block rounded-full bg-[var(--gold-soft)] px-2.5 py-0.5 text-xs font-semibold">
        {t.journey.statusVisited}
        {p.visitedAt ? ` · ${fmtDate(p.visitedAt)}` : ""}
      </span>
    );
  }
  return (
    <span className="inline-block rounded-full bg-[var(--good)] px-2.5 py-0.5 text-xs font-semibold text-white">
      {t.journey.statusCompleted}
      {p.feeStatus === "due" ? ` · $${p.feeAmount} ${t.journey.feeDue}` : ""}
      {p.feeStatus === "paid" ? ` · ${t.journey.feePaid}` : ""}
    </span>
  );
}

function DoorsAndJourney() {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const [name, setName] = useState(() => storedJourneyValue("elc-journey-name"));
  const [email, setEmail] = useState(() => storedJourneyValue("elc-journey-email"));
  const [activeEmail, setActiveEmail] = useState(() => storedJourneyValue("elc-journey-email"));
  const [lookupEmail, setLookupEmail] = useState("");
  const [dates, setDates] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const journeyQuery = useQuery({
    queryKey: ["journey", activeEmail],
    queryFn: () => api.getJourney({ email: activeEmail }),
    enabled: activeEmail.includes("@"),
  });
  const view: JourneyViewData | null = journeyQuery.data?.view ?? null;

  const start = useMutation({
    mutationFn: () => api.startJourney({ name: name.trim(), email: email.trim() }),
    onSuccess: (res) => {
      try {
        window.localStorage.setItem("elc-journey-name", name.trim());
        window.localStorage.setItem("elc-journey-email", email.trim());
      } catch {
        /* storage unavailable — session state still works */
      }
      setActiveEmail(email.trim());
      queryClient.setQueryData(["journey", email.trim()], res);
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: () => setNotice(t.journey.notFound),
  });

  const visit = useMutation({
    mutationFn: (doorId: DoorIdParam) =>
      api.recordDoorVisit({ email: activeEmail, name: name || view?.journey.name || "", doorId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journey", activeEmail] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
  });

  const complete = useMutation({
    mutationFn: (doorId: DoorIdParam) =>
      api.reportDoorCompletion({
        email: activeEmail,
        name: name || view?.journey.name || "",
        doorId,
        completedDate: dates[doorId] ?? "",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journey", activeEmail] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
  });

  const doorById = (id: DoorIdParam) => DOOR_CATALOG.find((d) => d.id === id);
  const progressOf = (id: DoorIdParam) => view?.doors.find((d) => d.doorId === id) ?? null;

  const onRegisterClick = (doorId: DoorIdParam) => {
    if (!activeEmail.includes("@")) {
      setNotice(t.journey.needJourney);
      return;
    }
    visit.mutate(doorId);
  };

  const renderCompleteControls = (id: DoorIdParam) => {
    const p = progressOf(id);
    if (!activeEmail.includes("@") || !view) return null;
    if (p?.status === "completed") {
      return (
        <p className="mt-3 text-sm font-medium text-[var(--good)]">
          ✓ {t.journey.statusCompleted}
          {p.completedDate ? ` · ${t.journey.finishedOn} ${p.completedDate}` : ""}
          {p.feeStatus === "due" ? ` · $${p.feeAmount} ${t.journey.feeDue}` : ""}
          {p.feeStatus === "paid" ? ` · ${t.journey.feePaid}` : ""}
        </p>
      );
    }
    return (
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor={`done-date-${id}`} className="block text-xs font-medium text-[var(--dim)]">
            {t.journey.dateLabel}
          </label>
          <input
            id={`done-date-${id}`}
            type="date"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--text)]"
            value={dates[id] ?? ""}
            onChange={(e) => setDates((d) => ({ ...d, [id]: e.target.value }))}
          />
        </div>
        <button
          type="button"
          className={btnGhost}
          disabled={complete.isPending}
          onClick={() => complete.mutate(id)}
        >
          {t.journey.markDone}
        </button>
      </div>
    );
  };

  return (
    <>
      {/* ---------- The doors ---------- */}
      <section id="doors" aria-label={t.doors.title} className="py-10">
        <SectionWithLogo sub={t.doors.sub}>{t.doors.title}</SectionWithLogo>

        <h3 className="font-display text-xl font-semibold">{t.doors.guidedTitle}</h3>
        <p className="mt-1 max-w-3xl text-sm text-[var(--dim)]">{t.doors.guidedSub}</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {GUIDED_DOOR_IDS.map((id) => {
            const door = doorById(id);
            const item = t.doors.items[id as keyof typeof t.doors.items];
            if (!door || !item) return null;
            return (
              <article key={id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h4 className="font-display text-lg font-semibold leading-snug">{door.name}</h4>
                  <DoorStatusChip door={door} view={view} />
                </div>
                <p className="mt-1.5 text-sm text-[var(--dim)]">{item.pays}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[var(--dim)]">
                  {t.doors.stepsLabel}
                </p>
                <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-[var(--dim)]">
                  {item.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
                <p className="mt-3 rounded-lg bg-[var(--gold-soft)] p-3 text-sm font-medium">
                  {t.doors.feeLine}
                </p>
                <a
                  href={door.url}
                  target="_blank"
                  rel="noreferrer"
                  className={`${btnGold} mt-3`}
                  onClick={() => onRegisterClick(id)}
                >
                  {t.doors.registerBtn} ↗
                </a>
                {renderCompleteControls(id)}
              </article>
            );
          })}
        </div>

        <h3 className="font-display mt-10 text-xl font-semibold">{t.doors.pointerTitle}</h3>
        <p className="mt-1 max-w-3xl text-sm text-[var(--dim)]">{t.doors.pointerSub}</p>
        <ul className="mt-4 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          {POINTER_DOOR_IDS.map((id) => {
            const door = doorById(id);
            const pays = t.doors.pointers[id as keyof typeof t.doors.pointers];
            if (!door || !pays) return null;
            const p = progressOf(id);
            return (
              <li key={id} className="flex flex-col gap-2 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-semibold leading-snug">{door.name}</p>
                  <p className="text-sm text-[var(--dim)]">{pays}</p>
                  <p className="mt-0.5 text-xs font-medium text-[var(--good)]">{t.doors.noFeeLine}</p>
                  {p?.status === "completed" ? (
                    <p className="text-xs font-medium text-[var(--good)]">✓ {t.journey.statusCompleted}</p>
                  ) : p?.status === "visited" ? (
                    <p className="text-xs text-[var(--dim)]">
                      {t.journey.statusVisited}
                      {p.visitedAt ? ` · ${fmtDate(p.visitedAt)}` : ""}
                    </p>
                  ) : null}
                </div>
                <a
                  href={door.url}
                  target="_blank"
                  rel="noreferrer"
                  className={`${btnGhost} w-full sm:w-auto sm:self-start`}
                  onClick={() => onRegisterClick(id)}
                >
                  {t.doors.registerBtn} ↗
                </a>
                {activeEmail.includes("@") && view && p?.status !== "completed" ? (
                  <button
                    type="button"
                    className="self-start text-sm font-semibold text-[var(--good)] underline"
                    disabled={complete.isPending}
                    onClick={() => complete.mutate(id)}
                  >
                    {t.journey.markDone}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
        {notice ? (
          <p className="mt-4 rounded-lg bg-[var(--gold-soft)] p-3 text-sm font-medium">{notice}</p>
        ) : null}
      </section>

      {/* ---------- The journey dashboard ---------- */}
      <section id="journey" aria-label={t.journey.title} className="py-10">
        <SectionWithLogo sub={t.journey.sub}>{t.journey.title}</SectionWithLogo>

        <div className="grid gap-4 lg:grid-cols-2">
          <form
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
            onSubmit={(e) => {
              e.preventDefault();
              setNotice(null);
              start.mutate();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="journey-name" className={labelCls}>{t.journey.nameLabel}</label>
                <input
                  id="journey-name"
                  className={inputCls}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  placeholder="e.g. Maria Gonzalez"
                />
              </div>
              <div>
                <label htmlFor="journey-email" className={labelCls}>{t.journey.emailLabel}</label>
                <input
                  id="journey-email"
                  type="email"
                  className={inputCls}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </div>
            </div>
            <button type="submit" className={`${btnGold} mt-4`} disabled={start.isPending}>
              {t.journey.startBtn}
            </button>
            <p className="mt-3 text-sm text-[var(--dim)]">{t.journey.emailSummaryNote}</p>
          </form>

          <form
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
            onSubmit={(e) => {
              e.preventDefault();
              setActiveEmail(lookupEmail.trim());
            }}
          >
            <label htmlFor="journey-lookup-email" className={labelCls}>{t.journey.emailLabel}</label>
            <input
              id="journey-lookup-email"
              type="email"
              className={inputCls}
              value={lookupEmail}
              onChange={(e) => setLookupEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
            <button type="submit" className={`${btnGhost} mt-4`}>
              {t.journey.lookupBtn}
            </button>
            <p className="mt-3 text-sm text-[var(--dim)]">{t.journey.resumeNote}</p>
            {journeyQuery.data && !journeyQuery.data.found ? (
              <p className="mt-2 text-sm font-medium text-red-700">{t.journey.notFound}</p>
            ) : null}
          </form>
        </div>

        {view ? (
          <div className="mt-6 space-y-6">
            <div className="rounded-xl border-2 border-[var(--gold)] bg-[var(--surface)] p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--gold)]">
                {t.journey.numberLabel}
              </p>
              <p className="font-display mt-1 text-3xl font-semibold">{view.journey.journeyNumber}</p>
              <p className="mt-1 text-sm text-[var(--dim)]">
                {view.journey.name} · {view.journey.email}
              </p>
              <p className="mt-3 rounded-lg bg-[var(--gold-soft)] p-3 text-sm font-medium">
                {t.journey.selfReportedNote}
              </p>
            </div>

            <div>
              <h3 className="font-display text-lg font-semibold">{t.journey.yourDoors}</h3>
              <ul className="mt-2 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                {view.doors.map((d) => (
                  <li key={d.doorId} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                    <span className="min-w-0 flex-1 text-sm font-medium">{d.name}</span>
                    <span className="text-xs text-[var(--dim)]">
                      {d.tier === "guided" ? t.doors.guidedBadge : t.doors.pointerBadge}
                    </span>
                    {d.status === "completed" ? (
                      <span className="text-sm font-semibold text-[var(--good)]">
                        ✓ {t.journey.statusCompleted}
                        {d.completedDate ? ` · ${d.completedDate}` : ""}
                        {d.feeStatus === "due" ? ` · $${d.feeAmount} ${t.journey.feeDue}` : ""}
                        {d.feeStatus === "paid" ? ` · ${t.journey.feePaid}` : ""}
                      </span>
                    ) : d.status === "visited" ? (
                      <span className="text-sm text-[var(--dim)]">
                        {t.journey.statusVisited}
                        {d.visitedAt ? ` · ${fmtDate(d.visitedAt)}` : ""}
                      </span>
                    ) : (
                      <span className="text-sm text-[var(--dim)]">{t.journey.statusNotStarted}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {view.cases.length > 0 ? (
              <div>
                <h3 className="font-display text-lg font-semibold">{t.journey.casesTitle}</h3>
                <ul className="mt-2 space-y-2">
                  {view.cases.map((c) => (
                    <li key={c.caseNumber} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm">
                      <strong>{c.caseNumber}</strong> · {c.childName} · {statusLabel(c.status)} · ${c.feeAmount}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {view.sittings.length > 0 ? (
              <div>
                <h3 className="font-display text-lg font-semibold">{t.journey.sittingsTitle}</h3>
                <ul className="mt-2 space-y-2">
                  {view.sittings.map((s) => (
                    <li key={s.sittingNumber} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm">
                      <strong>{s.sittingNumber}</strong> · {s.childName} · {statusLabel(s.status)} · ${s.feeAmount}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div>
              <h3 className="font-display text-lg font-semibold">{t.journey.reportsTitle}</h3>
              {view.reports.length > 0 ? (
                <ul className="mt-2 space-y-2">
                  {view.reports.map((r) => (
                    <li key={r.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm">
                      {r.subject} · {fmtDateTime(r.createdAt)} ·{" "}
                      {r.status === "sent" ? t.journey.reportSent : t.journey.reportRecorded}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-[var(--dim)]">{t.journey.noReports}</p>
              )}
            </div>
          </div>
        ) : null}
      </section>
    </>
  );
}

// The on-site AI assistant: answers automatically from the Center's own
// verified content (server-side knowledge base + ctx.inference), in the
// visitor's selected language. Anything it cannot answer routes to
// booking a human sitting.
function AssistantPanel() {
  const { t, lang } = useLang();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<{ role: "user" | "ai"; text: string; needsHuman?: boolean }[]>([]);

  const ask = useMutation({
    mutationFn: (q: string) => api.askAssistant({ question: q, lang }),
    onSuccess: (res) =>
      setMsgs((m) => [...m, { role: "ai", text: res.answer, needsHuman: res.needsHuman }]),
    onError: () =>
      setMsgs((m) => [...m, { role: "ai", text: t.assistant.error, needsHuman: true }]),
  });

  const submit = (q: string) => {
    const question = q.trim();
    if (!question || ask.isPending) return;
    setMsgs((m) => [...m, { role: "user", text: question }]);
    setInput("");
    ask.mutate(question);
  };

  if (!open) {
    return (
      <button
        type="button"
        aria-label={t.assistant.openBtn}
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-50 inline-flex items-center justify-center rounded-full bg-[var(--gold)] px-5 py-3 text-sm font-semibold text-[#16294d] shadow-lg"
      >
        {t.assistant.openBtn}
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex max-h-[75vh] w-[min(92vw,380px)] flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
        <div>
          <h2 className="font-display text-base font-semibold">{t.assistant.title}</h2>
          <p className="mt-0.5 text-xs text-[var(--dim)]">{t.assistant.sub}</p>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={() => setOpen(false)}
          className="shrink-0 rounded-lg border border-[var(--border)] px-2.5 py-1 text-sm font-semibold"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        <p className="rounded-xl bg-[var(--gold-soft)] p-3 text-sm">{t.assistant.greeting}</p>
        {msgs.map((m, i) =>
          m.role === "user" ? (
            <p key={i} className="ml-8 rounded-xl bg-[#16294d] p-3 text-sm text-white">
              {m.text}
            </p>
          ) : (
            <div key={i} className="mr-4">
              <p className="rounded-xl border border-[var(--border)] p-3 text-sm">{m.text}</p>
              {m.needsHuman ? (
                <div className="mt-2 rounded-xl border border-[var(--border)] p-3 text-sm">
                  <p className="font-medium">{t.assistant.bookPrompt}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <a href="#case529" className={btnGold} onClick={() => setOpen(false)}>
                      {t.assistant.bookCase}
                    </a>
                    <a href="#withdrawal" className={btnGhost} onClick={() => setOpen(false)}>
                      {t.assistant.bookWithdrawal}
                    </a>
                  </div>
                </div>
              ) : null}
            </div>
          ),
        )}
        {ask.isPending ? <p className="text-sm text-[var(--dim)]">{t.assistant.thinking}</p> : null}
        {msgs.length === 0 ? (
          <div className="flex flex-wrap gap-2">
            {t.assistant.chips.map((c) => (
              <button
                key={c}
                type="button"
                className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium"
                onClick={() => submit(c)}
              >
                {c}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <form
        className="border-t border-[var(--border)] px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
      >
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="assistant-input">{t.assistant.placeholder}</label>
          <input
            id="assistant-input"
            className={inputCls}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t.assistant.placeholder}
            maxLength={600}
          />
          <button type="submit" className={`${btnGold} shrink-0`} disabled={ask.isPending}>
            {t.assistant.send}
          </button>
        </div>
        <p className="mt-2 text-xs text-[var(--dim)]">{t.assistant.privacyNote}</p>
      </form>
    </div>
  );
}

// QR code for the electronic member card — encodes the member number
// only (see qr.ts). Rendered on a white ground with a quiet zone so any
// phone camera at a partner store can scan it.
function QrSvg({ value, size = 128 }: { value: string; size?: number }) {
  let matrix: boolean[][] | null = null;
  try {
    matrix = qrMatrix(value);
  } catch {
    matrix = null;
  }
  if (!matrix) return null;
  const quiet = 4;
  const total = matrix.length + quiet * 2;
  const cells: ReactNode[] = [];
  matrix.forEach((row, r) => {
    row.forEach((dark, c) => {
      if (dark) cells.push(<rect key={`${r}-${c}`} x={c + quiet} y={r + quiet} width={1.02} height={1.02} />);
    });
  });
  return (
    <svg
      viewBox={`0 0 ${total} ${total}`}
      width={size}
      height={size}
      role="img"
      aria-label={`QR code — member number ${value}`}
      className="shrink-0 rounded-lg"
    >
      <rect x={0} y={0} width={total} height={total} fill="#ffffff" />
      <g fill="#101623">{cells}</g>
    </svg>
  );
}

// Staff-assisted membership application — the participant pipeline's
// form step, run from inside Admin while the public subscribe stays
// parked on the waitlist. On opening, the same shared pipeline serves
// the public subscribe.
function MembershipApplicationForm() {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const mp = t.memberPipeline;
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Oklahoma City");
  const [tier, setTier] = useState<"starter" | "family" | "family_plus">("family");
  const [referralCode, setReferralCode] = useState("");
  const [kids, setKids] = useState<{ name: string; birthYear: string; schoolLevel: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const apply = useMutation({
    mutationFn: () =>
      api.applyForMembership({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        city: city.trim() || "Oklahoma City",
        state: "OK",
        tier,
        referralCode: referralCode.trim() === "" ? undefined : referralCode.trim(),
        children: kids
          .filter((k) => k.name.trim() !== "")
          .map((k) => ({
            name: k.name.trim(),
            birthYear: Number(k.birthYear) || 2018,
            schoolLevel: k.schoolLevel.trim(),
          })),
      }),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "The application could not be saved."),
  });

  const result = apply.data;
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h3 className="font-display text-lg font-semibold">{mp.appTitle}</h3>
      <p className="mt-1 text-sm text-[var(--dim)]">{mp.appSub}</p>
      <form
        className="mt-4 grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          apply.mutate();
        }}
      >
        <div>
          <label htmlFor="mp-name" className={labelCls}>{mp.nameLabel}</label>
          <input id="mp-name" className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="mp-email" className={labelCls}>{mp.emailLabel}</label>
          <input id="mp-email" type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="mp-phone" className={labelCls}>{mp.phoneLabel}</label>
          <input id="mp-phone" className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="mp-city" className={labelCls}>{mp.cityLabel}</label>
          <input id="mp-city" className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div>
          <label htmlFor="mp-tier" className={labelCls}>{mp.tierLabel}</label>
          <select id="mp-tier" className={inputCls} value={tier} onChange={(e) => setTier(e.target.value as "starter" | "family" | "family_plus")}>
            {TIER_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label} — ${o.price} one time
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="mp-referral" className={labelCls}>{mp.referralLabel}</label>
          <input id="mp-referral" className={inputCls} value={referralCode} onChange={(e) => setReferralCode(e.target.value)} />
        </div>
        <fieldset className="sm:col-span-2">
          <legend className={labelCls}>{mp.childrenLabel}</legend>
          <div className="space-y-3">
            {kids.map((kid, i) => (
              <div key={i} className="grid gap-3 sm:grid-cols-4">
                <input aria-label={mp.childName} className={inputCls} value={kid.name} placeholder={mp.childName} onChange={(e) => setKids(kids.map((k, j) => (j === i ? { ...k, name: e.target.value } : k)))} />
                <input aria-label={mp.birthYear} className={inputCls} inputMode="numeric" value={kid.birthYear} placeholder={mp.birthYear} onChange={(e) => setKids(kids.map((k, j) => (j === i ? { ...k, birthYear: e.target.value.replace(/\D/g, "") } : k)))} />
                <input aria-label={mp.schoolLevel} className={inputCls} value={kid.schoolLevel} placeholder={mp.schoolLevel} onChange={(e) => setKids(kids.map((k, j) => (j === i ? { ...k, schoolLevel: e.target.value } : k)))} />
                <button type="button" className={btnGhost} onClick={() => setKids(kids.filter((_, j) => j !== i))}>
                  {mp.removeChild}
                </button>
              </div>
            ))}
          </div>
          <button type="button" className={`${btnGhost} mt-3`} onClick={() => setKids([...kids, { name: "", birthYear: "", schoolLevel: "" }])}>
            {mp.addChild}
          </button>
        </fieldset>
        <div className="sm:col-span-2">
          <button type="submit" className={btnPrimary} disabled={apply.isPending}>
            {mp.submitApp}
          </button>
          {error ? <p className="mt-3 text-base text-red-700">{error}</p> : null}
        </div>
      </form>
      {result ? (
        <div className="mt-5 rounded-xl border border-[var(--good)] bg-[var(--gold-soft)] p-4">
          <p className="font-semibold">{mp.appSaved}</p>
          <dl className="mt-3 grid gap-2 text-base sm:grid-cols-2">
            <div>
              <dt className="text-sm text-[var(--dim)]">{mp.memberNo}</dt>
              <dd className="font-mono font-semibold">{result.member.memberNumber}</dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--dim)]">{mp.invoiceNo}</dt>
              <dd className="font-mono font-semibold">{result.invoice.invoiceNumber}</dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--dim)]">{mp.payRef}</dt>
              <dd className="font-mono text-xl font-bold">{result.invoice.paymentReference}</dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--dim)]">{mp.amountDue}</dt>
              <dd className="font-semibold">${result.invoice.amount}</dd>
            </div>
          </dl>
          {result.accessKey ? (
            <p className="mt-3 text-sm">
              {mp.accessKeyOnce}: <span className="font-mono font-semibold break-all">{result.accessKey}</span>
            </p>
          ) : null}
          <p className="mt-3 text-sm text-[var(--dim)]">{mp.bankNote}</p>
        </div>
      ) : null}
    </div>
  );
}

// Operations confirms a fee payment at the Center's bank account, by
// payment reference — the step that activates the membership and
// issues the electronic card automatically.
function ConfirmBankPaymentForm({ adminCode }: { adminCode: string }) {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const mp = t.memberPipeline;
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);

  const confirm = useMutation({
    mutationFn: () => api.confirmBankPayment({ adminCode, paymentReference: reference.trim() }),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      queryClient.invalidateQueries({ queryKey: ["public-stats"] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "The payment could not be confirmed."),
  });

  const result = confirm.data;
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h3 className="font-display text-lg font-semibold">{mp.confirmTitle}</h3>
      <p className="mt-1 text-sm text-[var(--dim)]">{mp.confirmSub}</p>
      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          confirm.mutate();
        }}
      >
        <div className="min-w-56 flex-1">
          <label htmlFor="mp-payref" className={labelCls}>{mp.payRefLabel}</label>
          <input id="mp-payref" className={`${inputCls} font-mono`} value={reference} onChange={(e) => setReference(e.target.value)} required placeholder="PAY-0001-001" />
        </div>
        <button type="submit" className={btnPrimary} disabled={confirm.isPending}>
          {mp.confirmBtn}
        </button>
      </form>
      {error ? <p className="mt-3 text-base text-red-700">{error}</p> : null}
      {result ? (
        <div className="mt-4 rounded-xl border border-[var(--good)] bg-[var(--gold-soft)] p-4 text-base">
          <p className="font-semibold">{result.alreadyPaid ? mp.alreadyMsg : mp.confirmedMsg}</p>
          <p className="mt-2">
            {mp.memberNo}: <span className="font-mono font-semibold">{result.memberNumber}</span>
            {result.receiptNumber ? (
              <>
                {" "}· {mp.receipt}: <span className="font-mono font-semibold">{result.receiptNumber}</span>
              </>
            ) : null}
            {result.cardIssued ? <> · {mp.cardIssued}</> : null}
          </p>
        </div>
      ) : null}
    </div>
  );
}

// Admin — Center operations, staff only (Founder, 2026-11-13). The
// public page carries no operational numbers; this section opens only
// a code prompt, and the server refuses the numbers without the code.
function AdminSection() {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [unlockedCode, setUnlockedCode] = useState<string | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);

  const overview = useQuery({
    queryKey: ["admin-overview", unlockedCode],
    queryFn: () => api.adminOverview({ adminCode: unlockedCode ?? "" }),
    enabled: unlockedCode !== null,
  });

  const unlock = useMutation({
    mutationFn: (c: string) => api.adminOverview({ adminCode: c }),
    onSuccess: (data, c) => {
      queryClient.setQueryData(["admin-overview", c], data);
      setUnlockedCode(c);
      setGateError(null);
    },
    onError: () => setGateError(t.ops.wrongCode),
  });

  const lock = () => {
    setUnlockedCode(null);
    setCode("");
    setGateError(null);
    queryClient.removeQueries({ queryKey: ["admin-overview"] });
  };

  const data = unlockedCode !== null ? overview.data : undefined;
  return (
    <section id="admin" aria-label={t.ops.gateTitle} className="py-10">
      <SectionWithLogo sub={unlockedCode !== null ? t.ops.sub : t.ops.gateBody}>
        {t.ops.gateTitle}
      </SectionWithLogo>
      {unlockedCode === null ? (
        <form
          className="max-w-xl rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
          onSubmit={(e) => {
            e.preventDefault();
            setGateError(null);
            unlock.mutate(code.trim());
          }}
        >
          <label htmlFor="admin-code" className={labelCls}>{t.ops.codeLabel}</label>
          <div className="flex flex-wrap gap-3">
            <input
              id="admin-code"
              type="password"
              autoComplete="off"
              className={`${inputCls} min-w-52 flex-1`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t.ops.codePlaceholder}
              required
            />
            <button type="submit" className={btnPrimary} disabled={unlock.isPending}>
              {t.ops.unlockBtn}
            </button>
          </div>
          {gateError ? <p className="mt-3 text-base text-red-700">{gateError}</p> : null}
        </form>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
            <p className="text-base text-[var(--dim)]">{t.ops.unlockedNote}</p>
            <button type="button" className={btnGhost} onClick={lock}>
              {t.ops.lockBtn}
            </button>
          </div>
          {overview.isPending ? <p className="text-[var(--dim)]">{t.ops.loading}</p> : null}
          {data ? (
            <>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {[
                  { k: t.ops.tiles.members, v: data.totals.members },
                  { k: t.ops.tiles.awaitingActivation, v: data.totals.awaitingActivation },
                  { k: t.ops.tiles.waitlist, v: data.totals.waitlist },
                  { k: t.ops.tiles.children, v: data.totals.children },
                  { k: t.ops.tiles.applications, v: data.totals.applications },
                  { k: t.ops.tiles.openJobs, v: data.totals.openJobs },
                  { k: t.ops.tiles.partners, v: data.totals.partners },
                  { k: t.ops.tiles.monthly, v: `$${data.totals.monthlyRecurring}` },
                  { k: t.ops.tiles.goals, v: data.totals.plans529 },
                  { k: t.ops.tiles.saved, v: `$${data.totals.plans529SavedTotal.toLocaleString("en-US")}` },
                  { k: t.ops.tiles.casesStarted, v: data.totals.cases529 },
                  { k: t.ops.tiles.casesCompleted, v: data.totals.cases529Completed },
                  { k: t.ops.tiles.foundingLeft, v: data.casePricing.foundingRemaining },
                  { k: t.ops.tiles.nextFee, v: `$${data.casePricing.nextCaseFee}` },
                  { k: t.ops.tiles.feesEarned, v: `$${data.totals.caseFeesEarned.toLocaleString("en-US")}` },
                  { k: t.ops.tiles.feesDue, v: `$${data.totals.caseFeesDue.toLocaleString("en-US")}` },
                  { k: t.ops.tiles.sittingsStarted, v: data.totals.sittings },
                  { k: t.ops.tiles.sittingsCompleted, v: data.totals.sittingsCompleted },
                  { k: t.ops.tiles.sittingFeesEarned, v: `$${data.totals.sittingFeesEarned.toLocaleString("en-US")}` },
                  { k: t.ops.tiles.sittingFeesDue, v: `$${data.totals.sittingFeesDue.toLocaleString("en-US")}` },
                  { k: t.ops.tiles.journeys, v: data.totals.journeys },
                  { k: t.ops.tiles.doorsVisited, v: data.totals.doorsVisited },
                  { k: t.ops.tiles.doorsCompleted, v: data.totals.doorsCompleted },
                  { k: t.ops.tiles.navCompleted, v: data.totals.navCompletions },
                  { k: t.ops.tiles.navFeesDue, v: `$${data.totals.navFeesDue.toLocaleString("en-US")}` },
                  { k: t.ops.tiles.navFeesEarned, v: `$${data.totals.navFeesEarned.toLocaleString("en-US")}` },
                  { k: t.ops.tiles.emailReports, v: data.totals.emailReports },
                  { k: t.ops.tiles.emailReportsSent, v: data.totals.emailReportsSent },
                ].map((s) => (
                  <div key={s.k} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                    <dd className="font-display text-2xl font-semibold">{s.v}</dd>
                    <dt className="text-xs uppercase tracking-wide text-[var(--dim)]">{s.k}</dt>
                  </div>
                ))}
              </dl>
              <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 text-base text-[var(--dim)]">
                <strong className="text-[var(--text)]">{t.ops.privateStrong}</strong>{" "}
                {t.ops.privateBody}
              </p>
              <MembershipApplicationForm />
              <ConfirmBankPaymentForm adminCode={unlockedCode} />
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}

// Partner-store card verification (Founder, 2026-11-13): the store
// enters or scans the member number from the member's phone card and
// sees only valid/invalid, the plan, and the card status.
function PartnerVerifySection() {
  const { t } = useLang();
  const v = t.verify;
  const [memberNumber, setMemberNumber] = useState("");
  const check = useMutation({
    mutationFn: () => api.verifyMemberCard({ memberNumber: memberNumber.trim() }),
  });
  const result = check.data;
  const statusText = !result
    ? ""
    : !result.found
      ? v.notFound
      : result.cardStatus === "active"
        ? v.statusActive
        : result.cardStatus === "lapsed"
          ? v.statusLapsed
          : v.statusAwaiting;
  return (
    <section id="verify" aria-label={v.title} className="py-10">
      <SectionWithLogo sub={v.sub}>{v.title}</SectionWithLogo>
      <div className="max-w-xl rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            check.mutate();
          }}
        >
          <label htmlFor="verify-member-number" className={labelCls}>{v.memberNoLabel}</label>
          <div className="flex flex-wrap gap-3">
            <input
              id="verify-member-number"
              className={`${inputCls} min-w-52 flex-1 font-mono`}
              value={memberNumber}
              onChange={(e) => setMemberNumber(e.target.value)}
              placeholder={v.memberNoPlaceholder}
              required
            />
            <button type="submit" className={btnPrimary} disabled={check.isPending}>
              {v.btn}
            </button>
          </div>
        </form>
        {check.isError ? <p className="mt-3 text-base text-red-700">{v.invalid}</p> : null}
        {result ? (
          <div className={`mt-4 rounded-xl border p-4 ${result.valid ? "border-[var(--good)] bg-[var(--gold-soft)]" : "border-[var(--border)]"}`}>
            <p className="font-display text-xl font-semibold">
              {result.found ? (result.valid ? v.valid : v.invalid) : v.invalid}
            </p>
            {result.found ? (
              <dl className="mt-3 grid gap-2 text-base sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-[var(--dim)]">{v.tier}</dt>
                  <dd className="font-semibold">{result.tierLabel}</dd>
                </div>
                <div>
                  <dt className="text-sm text-[var(--dim)]">{v.status}</dt>
                  <dd className="font-semibold">{statusText}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-2 text-base text-[var(--dim)]">{v.notFound}</p>
            )}
          </div>
        ) : null}
        <p className="mt-4 text-sm text-[var(--dim)]">{v.privacy}</p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Fintech payments — method setup, invoice payment, receipts, renewals
// ---------------------------------------------------------------------------

function PaymentPanel({ data }: { data: Dashboard }) {
  const queryClient = useQueryClient();
  const member = data.member;
  const pm = data.paymentMethod;
  const [method, setMethod] = useState<"card" | "bank_transfer">("card");
  const [last4, setLast4] = useState("");
  const [provider, setProvider] = useState("Fintech payment provider");
  const [autoRenew, setAutoRenew] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [payMsg, setPayMsg] = useState<string | null>(null);

  const setup = useMutation({
    mutationFn: () =>
      api.setupPaymentMethod({ memberId: member.id, accessKey: storedAccessKey(), method, provider, last4, autoRenew }),
    onSuccess: () => {
      setMsg("Payment method saved. Full card or bank details are entered on the provider's secure page — this system stores only the last four digits.");
      queryClient.invalidateQueries({ queryKey: ["dashboard", member.email] });
    },
    onError: () => setMsg("Could not save the payment method. Enter the last 4 digits only."),
  });

  const pay = useMutation({
    mutationFn: (invoiceId: number) => api.payInvoice({ memberId: member.id, accessKey: storedAccessKey(), invoiceId }),
    onSuccess: (res) => {
      setPayMsg(`Payment confirmed — the system issued your receipt ${res.receiptNumber} for $${res.amount}. It is listed below and in your activity log.`);
      queryClient.invalidateQueries({ queryKey: ["dashboard", member.email] });
    },
    onError: (e) => setPayMsg(e instanceof Error ? e.message : "Payment could not be completed."),
  });

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h3 className="font-display text-lg font-semibold">Payments — by fintech, receipted automatically</h3>
      <p className="mt-1 text-sm text-[var(--dim)]">
        Members pay by card or bank transfer through a licensed fintech payment provider,
        directly into the company's bank account. The Center never holds your money for
        services. Every payment is confirmed by the system and issued a numbered receipt;
        with automatic renewal on, each month's invoice is paid and receipted by the
        system — no office, no cash, no paperwork.
      </p>

      {pm ? (
        <p className="mt-3 rounded-lg bg-[var(--gold-soft)] p-3 text-sm font-medium">
          Your payment method: {pm.method === "card" ? "Card" : "Bank transfer"} •••• {pm.last4}{" "}
          via {pm.provider} · Automatic renewal {pm.autoRenew ? "ON" : "OFF"}
        </p>
      ) : (
        <p className="mt-3 text-sm text-[var(--dim)]">
          No payment method saved yet — add one below to pay invoices and switch on
          automatic renewal.
        </p>
      )}

      <form
        className="mt-4 grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          setMsg(null);
          setup.mutate();
        }}
      >
        <div>
          <label htmlFor="pm-method" className={labelCls}>Payment method</label>
          <select id="pm-method" className={inputCls} value={method} onChange={(e) => setMethod(e.target.value as "card" | "bank_transfer")}>
            <option value="card">Card (via payment provider)</option>
            <option value="bank_transfer">Bank transfer (via payment provider)</option>
          </select>
        </div>
        <div>
          <label htmlFor="pm-last4" className={labelCls}>Last 4 digits only</label>
          <input id="pm-last4" inputMode="numeric" maxLength={4} className={inputCls} value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, ""))} required placeholder="e.g. 4242" />
        </div>
        <div>
          <label htmlFor="pm-provider" className={labelCls}>Payment provider</label>
          <input id="pm-provider" className={inputCls} value={provider} onChange={(e) => setProvider(e.target.value)} required />
        </div>
        <div className="flex items-end pb-1">
          <label className="flex min-h-8 cursor-pointer items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} className="h-5 w-5" />
            Automatic renewal — the system pays and receipts each month's invoice
          </label>
        </div>
        <div className="sm:col-span-2">
          <button type="submit" className={btnGhost} disabled={setup.isPending}>
            {setup.isPending ? "Saving…" : pm ? "Update payment method" : "Save payment method"}
          </button>
          {msg ? <p className="mt-2 text-sm text-[var(--dim)]">{msg}</p> : null}
        </div>
      </form>

      <h4 className="mt-5 font-semibold">Invoices</h4>
      {data.invoices.length === 0 ? (
        <p className="mt-1 text-sm text-[var(--dim)]">No invoices yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-[var(--border)]">
          {data.invoices.map((inv) => (
            <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div>
                <p className="font-medium">{inv.invoiceNumber}</p>
                <p className="text-sm text-[var(--dim)]">{inv.periodLabel}</p>
                {inv.paymentReference ? (
                  <p className="text-sm text-[var(--dim)]">
                    Bank payment reference:{" "}
                    <span className="font-mono font-semibold text-[var(--text)]">{inv.paymentReference}</span>
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="font-semibold">${inv.amount}</p>
                  <p className="text-sm text-[var(--dim)]">{statusLabel(inv.status)}</p>
                </div>
                {inv.status !== "paid" && inv.status !== "covered_by_referral_reward" ? (
                  <button
                    type="button"
                    className={btnPrimary}
                    disabled={pay.isPending || !pm}
                    title={pm ? "Pay this invoice by fintech" : "Save a payment method first"}
                    onClick={() => {
                      setPayMsg(null);
                      pay.mutate(inv.id);
                    }}
                  >
                    Pay by fintech
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      {!pm ? <p className="mt-1 text-sm text-[var(--dim)]">Save a payment method above to enable the Pay buttons.</p> : null}
      {payMsg ? <p className="mt-2 text-sm font-medium">{payMsg}</p> : null}

      {data.payments.length > 0 ? (
        <>
          <h4 className="mt-5 font-semibold">Receipts</h4>
          <ul className="mt-2 divide-y divide-[var(--border)]">
            {data.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div>
                  <p className="font-medium">{p.receiptNumber}</p>
                  <p className="text-sm text-[var(--dim)]">
                    {p.invoiceNumber} · {p.method === "card" ? "Card" : "Bank transfer"} via {p.provider} · {fmtDate(p.createdAt)}
                  </p>
                </div>
                <p className="font-semibold text-[var(--good)]">${p.amount} · {p.status}</p>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Partners — schools, education services, banks & credit unions, employers
// ---------------------------------------------------------------------------

const PARTNER_TYPES = [
  {
    key: "school",
    title: "Schools",
    text: "Public, charter, and private schools partner with the Center so their students' families can join one membership that follows the child through the whole education life.",
  },
  {
    key: "education_service",
    title: "Education-supporting services",
    text: "Tutoring centers, after-school programs, school-supply and transport providers, and other services that support students — delivered to members through the Center's system.",
  },
  {
    key: "bank_credit_union",
    title: "Partner banks & credit unions",
    text: "Licensed institutions that receive Family Credit Support applications from the system, review them, and make the decisions (Term Advance joins them when it opens later). The Center never lends.",
  },
  {
    key: "employer",
    title: "Employers",
    text: "Oklahoma employers post openings on the Job Promotion board and receive member applications automatically — carrying graduates to the goal line: a first job.",
  },
] as const;

function PartnersSection() {
  const { t } = useLang();
  return (
    <section id="partners" aria-label={t.partners.title} className="py-10">
      <SectionWithLogo sub={t.partners.sub}>
        {t.partners.title}
      </SectionWithLogo>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PARTNER_TYPES.map((p, idx) => (
          <article key={p.key} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h3 className="font-display text-lg font-semibold">{t.partners.types[idx]?.title ?? p.title}</h3>
            <p className="mt-2 text-sm text-[var(--dim)]">{t.partners.types[idx]?.text ?? p.text}</p>
          </article>
        ))}
      </div>
      <Details summary={t.partners.registerSummary}>
        <PartnerIntakeForm />
      </Details>
    </section>
  );
}

function PartnerIntakeForm() {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const [orgName, setOrgName] = useState("");
  const [partnerType, setPartnerType] = useState<"school" | "education_service" | "bank_credit_union" | "employer" | "other">("school");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Oklahoma City");
  const [servicesInterest, setServicesInterest] = useState("");
  const [message, setMessage] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const register = useMutation({
    mutationFn: () =>
      api.registerPartner({
        orgName,
        partnerType,
        contactName,
        email,
        phone,
        city,
        servicesInterest,
        message,
      }),
    onSuccess: () => {
      setMsg("Thank you — your organization's interest is registered and saved. The Center will contact you to discuss service terms. Registering interest is not a contract and implies no government affiliation.");
      setOrgName("");
      setContactName("");
      setEmail("");
      setPhone("");
      setServicesInterest("");
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: () => setMsg("Could not save your registration. Please check the form and try again."),
  });

  return (
    <form
      className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        register.mutate();
      }}
    >
      <h3 className="font-display text-lg font-semibold">{t.partners.formTitle}</h3>
      <p className="mt-1 text-sm text-[var(--dim)]">
        {t.partners.formSub}
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="pt-org" className={labelCls}>{t.partners.org}</label>
          <input id="pt-org" className={inputCls} value={orgName} onChange={(e) => setOrgName(e.target.value)} required placeholder="e.g. OKC North High School" />
        </div>
        <div>
          <label htmlFor="pt-type" className={labelCls}>{t.partners.orgType}</label>
          <select id="pt-type" className={inputCls} value={partnerType} onChange={(e) => setPartnerType(e.target.value as typeof partnerType)}>
            <option value="school">{t.partners.typeSchool}</option>
            <option value="education_service">{t.partners.typeEdu}</option>
            <option value="bank_credit_union">{t.partners.typeBank}</option>
            <option value="employer">{t.partners.typeEmployer}</option>
            <option value="other">{t.partners.typeOther}</option>
          </select>
        </div>
        <div>
          <label htmlFor="pt-contact" className={labelCls}>{t.partners.contact}</label>
          <input id="pt-contact" className={inputCls} value={contactName} onChange={(e) => setContactName(e.target.value)} required placeholder="Full name" />
        </div>
        <div>
          <label htmlFor="pt-email" className={labelCls}>{t.partners.contactEmail}</label>
          <input id="pt-email" type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="contact@organization.org" />
        </div>
        <div>
          <label htmlFor="pt-phone" className={labelCls}>{t.partners.phone}</label>
          <input id="pt-phone" type="tel" className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(405) 555-0100" />
        </div>
        <div>
          <label htmlFor="pt-city" className={labelCls}>{t.forms.city}</label>
          <input id="pt-city" className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="pt-services" className={labelCls}>{t.partners.servicesInterest}</label>
          <input id="pt-services" className={inputCls} value={servicesInterest} onChange={(e) => setServicesInterest(e.target.value)} placeholder={t.partners.servicesPlaceholder} />
        </div>
        <div>
          <label htmlFor="pt-message" className={labelCls}>{t.partners.message}</label>
          <input id="pt-message" className={inputCls} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t.partners.messagePlaceholder} />
        </div>
      </div>
      <div className="mt-5">
        <button type="submit" className={btnGold} disabled={register.isPending}>
          {register.isPending ? t.partners.registering : t.partners.submit}
        </button>
        {msg ? <p className="mt-3 text-base">{msg}</p> : null}
      </div>
    </form>
  );
}
