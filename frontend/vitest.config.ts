import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules", ".next", "tests-e2e/**"],
    // The auth + queries tests share one Postgres DB and reset it in beforeEach.
    // Run all test files in a single fork to serialize DB access; parallelizing
    // would race the TRUNCATEs against in-flight INSERTs.
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
});
