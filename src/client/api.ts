// Typed RPC client (Cloudflare port, 2026-11-13). Types come straight from
// `src/server/actions.ts` — no codegen. Each action call POSTs the args as
// JSON to `/api/<actionName>` on the same origin, where the Worker runs the
// same handler the Muse spaces runtime ran. A handler error comes back as
// `{ "error": "<message>" }` and is thrown as an Error with that message —
// the same contract the space SDK client exposed.
//
// `import type { Actions }` is type-only by design: the client bundle never
// pulls in any server runtime (drizzle, D1, WebCrypto). With
// `verbatimModuleSyntax: true`, dropping `type` is a compile error.

import type { Actions } from "../server/actions";

async function callAction(name: string, args: unknown): Promise<unknown> {
  const res = await fetch(`/api/${encodeURIComponent(name)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(args ?? {}),
  });
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

export const api: Actions = new Proxy(
  {},
  {
    get(_target, prop) {
      if (typeof prop !== "string") return undefined;
      return (args: unknown) => callAction(prop, args);
    },
  },
) as Actions;

// Re-exported for convenience so client code can do
//
//     import { api, type ApiResponse } from "./api";
//     type Dashboard = ApiResponse<typeof api, "getDashboard">;

export type ApiRequest<C, K extends keyof Actions> = Parameters<Actions[K]>[0];
export type ApiResponse<C, K extends keyof Actions> = Awaited<
  ReturnType<Actions[K]>
>;
