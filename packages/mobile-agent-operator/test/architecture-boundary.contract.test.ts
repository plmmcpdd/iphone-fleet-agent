import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Mobile-Agent architecture boundary", () => {
  it("has no ADB, WDA, AndroidWorld or direct DeviceBackend route in MobileAgentPhoneOperator", async () => {
    const source = await readFile(
      resolve("packages/mobile-agent-operator/src/mobile-agent-phone-operator.ts"),
      "utf8",
    );
    expect(source).toContain("FleetDeviceAdapter");
    expect(source).not.toMatch(/\bDeviceBackend\b|\badb\b|AndroidWorld|\bWDA\b/);
  });

  it("keeps Mobile-Agent and GUI-Owl types out of Fleet domain/contracts and MCP", async () => {
    const paths = ["packages/domain/src", "packages/contracts/src", "apps/fleet-mcp/src/server.ts"];
    const contents = await Promise.all(
      paths.map(async (path) => {
        if (path.endsWith(".ts")) return readFile(resolve(path), "utf8");
        const { readdir } = await import("node:fs/promises");
        const files = await readdir(resolve(path));
        return Promise.all(
          files
            .filter((name) => name.endsWith(".ts"))
            .map((name) => readFile(resolve(path, name), "utf8")),
        ).then((items) => items.join("\n"));
      }),
    );
    expect(contents.join("\n")).not.toMatch(/MobileAgent|GUIOwl|GUI-Owl/);
  });
});
