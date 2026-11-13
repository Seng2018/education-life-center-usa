import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// Client build (Cloudflare port, 2026-11-13): bundles src/client/main.tsx
// into ./dist, which wrangler serves as static assets. The Worker
// (src/worker.ts) is bundled separately by wrangler itself at deploy/dev
// time and is NOT part of this build.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
