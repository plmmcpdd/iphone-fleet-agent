import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

async function packageDependencies(path: string): Promise<Record<string, string>> {
  const manifest = JSON.parse(await readFile(resolve(repoRoot, path), "utf8")) as {
    dependencies?: Record<string, string>;
  };
  return manifest.dependencies ?? {};
}

describe("harness-neutral boundary", () => {
  it.each(["apps/fleet-mcp/package.json", "apps/fleetctl/package.json"])(
    "%s reaches Fleet capability only through the control-plane facade",
    async (manifestPath) => {
      const dependencies = await packageDependencies(manifestPath);
      expect(dependencies["@iphone-fleet/control-plane"]).toBe("workspace:*");
      expect(dependencies).not.toHaveProperty("@iphone-fleet/postgres");
      expect(dependencies).not.toHaveProperty("@iphone-fleet/application");
      expect(dependencies).not.toHaveProperty("@iphone-fleet/inmemory");
      expect(dependencies).not.toHaveProperty("pg");
      expect(dependencies).not.toHaveProperty("@hatchet-dev/typescript-sdk");
    },
  );
});
