import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/evidence/**/*.integration.test.ts",
      "packages/observability/**/*.integration.test.ts",
      "packages/mobile-agent-operator/**/*.integration.test.ts",
    ],
    passWithNoTests: true,
    testTimeout: 30_000,
  },
});
