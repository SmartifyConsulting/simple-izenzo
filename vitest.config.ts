import { defineConfig } from "vitest/config";
import path from "node:path";

/** Node-environment unit tests only (contract checks for server-side modules). */
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
