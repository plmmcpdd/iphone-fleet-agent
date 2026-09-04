import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.integration.test.ts", "tests/**/*.integration.test.ts"],
    passWithNoTests: true,
    testTimeout: 30_000,
  },
});
