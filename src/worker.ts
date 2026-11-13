// Education Life Center USA — Cloudflare Worker entry (port, 2026-11-13).
//
// Serves the built client from static assets and answers POST /api/<action>
// with the SAME action handlers that ran on the Muse spaces runtime
// (src/server/actions.ts), backed by a D1 database through drizzle-orm.
// Request bodies are validated with the actions' own zod request schemas;
// handler results are returned as JSON verbatim; a handler that throws
// (formation-mode refusals, auth refusals, not-found) returns
// { "error": "<message>" } with HTTP 400, which the client surfaces as the
// action's error message — the same contract the space SDK client had.

import { drizzle } from "drizzle-orm/d1";
import { ActionDefs, type Ctx } from "./server/actions";
import * as schema from "./server/schema";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  // Optional Workers AI binding (dashboard: Settings → Bindings → Workers
  // AI). When present, askAssistant answers through it with the same
  // verified-facts system prompt; when absent, askAssistant returns the
  // safe needs-human fallback below. The site works fully without it.
  AI?: Ai;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

// Fallback for the on-site assistant when no inference provider is bound:
// warm, factual, and routes to a human — mirrors the "set needsHuman and
// route to the waitlist" instruction in the assistant's own prompt.
const ASSISTANT_FALLBACK = {
  answer:
    "Thank you for your question — that one is best answered by a person on our team, and I don't want to guess. The Center is in formation: the membership waitlist on this page is open now and saving names, and the $99 guided 529 case door and $199 guided withdrawal sittings open once Education Life Center USA, LLC is filed and its bank account exists. Joining the free waitlist is the live step today — the Center invites waitlist families first when the doors open.",
  needsHuman: true,
};

function makeCtx(env: Env, request: Request): Ctx {
  const db = drizzle(env.DB, { schema });
  // Cloudflare attaches the request's geolocation as request.cf; the
  // visitor counter (trackVisit) reads only the country from it.
  const cfCountry = (request as Request & { cf?: { country?: unknown } }).cf
    ?.country;
  return {
    db: () => db,
    invalidateQueries: () => {},
    clientCountry:
      typeof cfCountry === "string" && cfCountry ? cfCountry : undefined,
    agent: {
      // No email agent exists in this port: delivery stays "on its way".
      // Callers (generateEmailReports, confirmBankPayment) wrap this in
      // try/catch, so the reports remain recorded with status "recorded".
      spawnTask: async () => {
        throw new Error("email delivery agent is not part of the Cloudflare port");
      },
    },
    inference: {
      complete: async (prompt, opts) => {
        if (!env.AI) return ASSISTANT_FALLBACK;
        try {
          const result = (await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
            messages: [
              { role: "system", content: opts.system ?? "" },
              {
                role: "user",
                content: `${prompt}\n\nRespond with ONLY a JSON object of the form {"answer": string, "needsHuman": boolean} — no other text.`,
              },
            ],
          })) as { response?: string };
          const text = result.response ?? "";
          const start = text.indexOf("{");
          const end = text.lastIndexOf("}");
          if (start < 0 || end <= start) return ASSISTANT_FALLBACK;
          const parsed = JSON.parse(text.slice(start, end + 1)) as {
            answer?: unknown;
            needsHuman?: unknown;
          };
          if (typeof parsed.answer !== "string") return ASSISTANT_FALLBACK;
          return {
            answer: parsed.answer,
            needsHuman: parsed.needsHuman === true,
          };
        } catch {
          return ASSISTANT_FALLBACK;
        }
      },
    },
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      const name = decodeURIComponent(url.pathname.slice("/api/".length));
      // Loose dispatch typing: the registry's concrete per-action types are
      // enforced inside actions.ts; here we only need the shared shape.
      type LooseDef = {
        request: {
          safeParse: (v: unknown) =>
            | { success: true; data: unknown }
            | {
                success: false;
                error: {
                  issues: { path: (string | number)[]; message: string }[];
                };
              };
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        handler: (ctx: Ctx, args: any) => Promise<unknown>;
      };
      const def = (ActionDefs as unknown as Record<string, LooseDef>)[name];
      if (!def) return json({ error: `Unknown action: ${name}` }, 404);
      if (request.method !== "POST") {
        return json({ error: "Actions are called with POST." }, 405);
      }
      let raw: unknown = {};
      try {
        raw = await request.json();
      } catch {
        raw = {};
      }
      const parsed = def.request.safeParse(raw ?? {});
      if (!parsed.success) {
        const message = parsed.error.issues
          .map((i) => `${i.path.length ? `${i.path.join(".")}: ` : ""}${i.message}`)
          .join("; ");
        return json({ error: message || "The request was not valid." }, 400);
      }
      try {
        const result = await def.handler(makeCtx(env, request), parsed.data);
        return json(result ?? { ok: true });
      } catch (err) {
        return json(
          { error: err instanceof Error ? err.message : String(err) },
          400,
        );
      }
    }
    // Everything else is a static asset (the built client).
    return env.ASSETS.fetch(request);
  },
};
