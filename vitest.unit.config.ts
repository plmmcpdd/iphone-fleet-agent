import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.unit.test.ts", "apps/**/*.unit.test.ts"],
    testTimeout: 10_000,
  },
});
