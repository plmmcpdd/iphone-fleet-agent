import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["apps/fleet-mcp/**/*.black-box.test.ts"],
    testTimeout: 20_000,
  },
});
