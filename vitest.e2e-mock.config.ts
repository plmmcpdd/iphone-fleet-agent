import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.e2e-mock.test.ts"],
    passWithNoTests: true,
    testTimeout: 30_000,
  },
});
