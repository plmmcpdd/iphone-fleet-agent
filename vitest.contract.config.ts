import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.contract.test.ts"],
    testTimeout: 10_000,
  },
});
