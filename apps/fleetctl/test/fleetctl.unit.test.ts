import { createMockFleetRuntime } from "@iphone-fleet/control-plane";
import { describe, expect, it } from "vitest";
import { runFleetCtl } from "../src/main.js";

describe("fleetctl", () => {
  it("runs the complete mock demo and prints evidence", async () => {
    const { controlPlane } = createMockFleetRuntime();
    const lines: string[] = [];
    await expect(
      runFleetCtl(["demo", "JOB-CLI-001"], controlPlane, (line) => lines.push(line)),
    ).resolves.toBe(0);
    const output = JSON.parse(lines.join("\n")) as { job: { state: string }; evidence: unknown[] };
    expect(output.job.state).toBe("SUCCEEDED");
    expect(output.evidence).toHaveLength(1);
  });
});
