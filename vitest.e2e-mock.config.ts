import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.e2e-mock.test.ts", "apps/**/*.e2e-mock.test.ts"],
    passWithNoTests: true,
    testTimeout: 30_000,
  },
});
