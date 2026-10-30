import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "src"),
    },
  },
  test: {
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts", "supabase/functions/**/*.test.ts"],
    exclude: ["node_modules/**"],
    testTimeout: 30_000,
  },
});
