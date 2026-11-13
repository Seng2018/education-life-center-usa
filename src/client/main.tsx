import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./theme.css";

// Cloudflare port (2026-11-13): the space runtime's shared query client is
// replaced by a plain react-query QueryClient. The App manages its own
// cache keys and invalidations, unchanged.
const queryClient = new QueryClient();

const rootEl = document.querySelector<HTMLElement>("[data-generated-space-root]");
if (!rootEl) {
  throw new Error("missing generated space root element");
}

// Keep BOTH the `hatch-space-root` class AND the `data-hatch-space-root`
// attribute on the outer div: the stylesheet (theme.css, unchanged from the
// reference build) selects on `.hatch-space-root[data-hatch-space-root]` to
// apply mobile safe-area insets, viewport sizing, and chrome offsets.
createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <div className="hatch-space-root" data-hatch-space-root>
        <App />
      </div>
    </QueryClientProvider>
  </StrictMode>,
);
