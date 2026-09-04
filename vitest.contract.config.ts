import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/**/*.contract.test.ts",
      "apps/**/*.contract.test.ts",
      "tests/**/*.contract.test.ts",
    ],
    testTimeout: 10_000,
  },
});
