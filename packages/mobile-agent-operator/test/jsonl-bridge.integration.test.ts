import { resolve } from "node:path";
import type { ExecutionContext, PhoneObservation } from "@iphone-fleet/contracts";
import { describe, expect, it } from "vitest";
import { JsonlMobileAgentBridge } from "../src/index.js";

const context: ExecutionContext = {
  jobId: "JOB-JSONL",
  clientId: "CLIENT-001",
  accountId: "ACCOUNT-001",
  deviceId: "DEVICE-001",
  networkAssignmentId: "NETWORK-001",
  leaseId: "LEASE-001",
  fencingToken: 1,
  actorId: "MA1-TEST",
  correlationId: "CORR-JSONL",
};
const observation: PhoneObservation = {
  screenshotRef: "mock://screen",
  screen: { width: 320, height: 568 },
  foregroundApp: "SpringBoard",
  observedAt: "2026-09-07T00:00:00.000Z",
};

describe("Mobile-Agent Python JSONL boundary", () => {
  it("uses deterministic framing and a recorded fixture without a device backend", async () => {
    const bridge = new JsonlMobileAgentBridge({
      command: "py",
      args: [
        resolve("operators/mobile-agent/worker.py"),
        "--fixture",
        resolve("operators/mobile-agent/fixtures/safe-navigation.json"),
      ],
      cwd: process.cwd(),
    });
    try {
      await bridge.start({
        context,
        instruction: "safe navigation",
        model: "RECORDED_MODEL_FIXTURE",
        maxSteps: 3,
        metadata: {},
      });
      await expect(
        bridge.next(
          { context, observation, history: [], stepNumber: 1 },
          { signal: new AbortController().signal, timeoutMs: 2_000 },
        ),
      ).resolves.toMatchObject({ action: "open", text: "Settings" });
    } finally {
      await bridge.close();
    }
  });
});
