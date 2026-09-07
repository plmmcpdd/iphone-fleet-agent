import type { PolicyEvaluator } from "@iphone-fleet/domain";
import { SafePhoneOperatorPolicy } from "@iphone-fleet/phone-operator";
import { describe, expect, it } from "vitest";
import { createOperatorHarness } from "./support.js";

const successful = [
  { action: "open", text: "Settings", tokenUsage: { input: 10, output: 2 } },
  {
    action: "terminate",
    status: "success",
    decisionSummary: "done",
    tokenUsage: { input: 12, output: 3 },
  },
] as const;

describe("PhoneOperator contract", () => {
  it("binds one context/device and succeeds only after Fleet verification", async () => {
    const harness = await createOperatorHarness({ runtime: { proposals: successful } });
    const result = await harness.operator.run(harness.task);
    expect(result).toMatchObject({
      status: "SUCCEEDED",
      stepCount: 2,
      screenshotCount: 2,
      modelCallCount: 2,
      tokenUsage: { input: 22, output: 5 },
      completion: { verified: true },
    });
    expect(harness.backend.calls).toHaveLength(1);
    expect(harness.backend.calls[0]?.context.deviceId).toBe("DEVICE-001");
  });

  it("maps Fleet observation without exposing fleet inventory", async () => {
    const harness = await createOperatorHarness({ runtime: { proposals: successful } });
    await expect(harness.adapter.observe(1)).resolves.toMatchObject({
      screen: { width: 320, height: 568 },
      foregroundApp: "SpringBoard",
    });
  });

  it("records structured per-step evidence and model fixture identity", async () => {
    const harness = await createOperatorHarness({ runtime: { proposals: successful } });
    await harness.operator.run(harness.task);
    const records = await harness.evidence.listByJob("JOB-001");
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      context: harness.context,
      details: {
        operator: "mobile-agent-v3.5",
        model: "RECORDED_MODEL_FIXTURE",
        observationArtifactRef: expect.any(String),
        proposedAction: { action: "open" },
      },
    });
  });

  it("fails closed on an unknown action", async () => {
    const harness = await createOperatorHarness({
      runtime: { proposals: [{ action: "teleport" }] },
    });
    await expect(harness.operator.run(harness.task)).resolves.toMatchObject({
      status: "FAILED",
      failure: { code: "UNSUPPORTED_OPERATOR_ACTION" },
    });
    expect(harness.backend.calls).toHaveLength(0);
  });

  it("enforces policy denial before a device side effect", async () => {
    const policy: PolicyEvaluator = {
      evaluate: async () => ({ outcome: "DENY", reason: "denied by test" }),
    };
    const harness = await createOperatorHarness({ policy, runtime: { proposals: successful } });
    await expect(harness.operator.run(harness.task)).resolves.toMatchObject({
      status: "FAILED",
      failure: { code: "POLICY_DENIED" },
    });
    expect(harness.backend.calls).toHaveLength(0);
  });

  it("turns an upstream human interaction into HUMAN_REQUIRED", async () => {
    const harness = await createOperatorHarness({
      runtime: { proposals: [{ action: "interact", text: "Complete 2FA" }] },
    });
    await expect(harness.operator.run(harness.task)).resolves.toMatchObject({
      status: "HUMAN_REQUIRED",
      humanRequired: { reason: "Complete 2FA" },
    });
  });

  it("uses the MA1 safe profile to gate taps and sensitive actions", async () => {
    const harness = await createOperatorHarness({
      policy: new SafePhoneOperatorPolicy(),
      runtime: { proposals: [{ action: "click", coordinate: [500, 500] }] },
    });
    await expect(harness.operator.run(harness.task)).resolves.toMatchObject({
      status: "HUMAN_REQUIRED",
      failure: { code: "HUMAN_REQUIRED" },
    });
    expect(harness.backend.calls).toHaveLength(0);
  });

  it("rejects a task bound to a different device", async () => {
    const harness = await createOperatorHarness({ runtime: { proposals: successful } });
    await expect(
      harness.operator.run({
        ...harness.task,
        executionContext: { ...harness.context, deviceId: "DEVICE-OTHER" },
      }),
    ).resolves.toMatchObject({ status: "FAILED", failure: { code: "WRONG_DEVICE" } });
  });

  it("rejects a wrong account assignment before side effects", async () => {
    const harness = await createOperatorHarness({ runtime: { proposals: successful } });
    harness.registry.setDevice({
      id: "DEVICE-001",
      clientId: "CLIENT-001",
      accountId: "ACCOUNT-OTHER",
      networkAssignmentId: "NETWORK-001",
      state: "READY",
    });
    await expect(harness.operator.run(harness.task)).resolves.toMatchObject({
      status: "FAILED",
      failure: { code: "WRONG_ACCOUNT" },
    });
    expect(harness.backend.calls).toHaveLength(0);
  });

  it("rejects a wrong network assignment before side effects", async () => {
    const harness = await createOperatorHarness({ runtime: { proposals: successful } });
    harness.registry.setNetworkAssignment({
      id: "NETWORK-001",
      clientId: "CLIENT-001",
      accountId: "ACCOUNT-001",
      deviceId: "DEVICE-OTHER",
      state: "READY",
    });
    await expect(harness.operator.run(harness.task)).resolves.toMatchObject({
      status: "FAILED",
      failure: { code: "WRONG_NETWORK_ASSIGNMENT" },
    });
    expect(harness.backend.calls).toHaveLength(0);
  });

  it("rejects an expired lease", async () => {
    const harness = await createOperatorHarness({ runtime: { proposals: successful } });
    harness.clock.advance(60_000);
    await expect(harness.operator.run(harness.task)).resolves.toMatchObject({
      status: "FAILED",
      failure: { code: "LEASE_EXPIRED" },
    });
  });

  it("revalidates fencing before every action and blocks all actions after staleness", async () => {
    let harness: Awaited<ReturnType<typeof createOperatorHarness>>;
    harness = await createOperatorHarness({
      runtime: {
        proposals: [
          { action: "open", text: "Settings" },
          { action: "system_button", button: "Home" },
          { action: "terminate", status: "success" },
        ],
        onProposal(step) {
          if (step === 2) harness.leases.supersedeActive("DEVICE-001");
        },
      },
    });
    await expect(harness.operator.run(harness.task)).resolves.toMatchObject({
      status: "FAILED",
      failure: { code: "STALE_FENCING_TOKEN" },
    });
    expect(harness.backend.calls.map((call) => call.action.name)).toEqual(["open_app"]);
  });

  it("cancels between observation and action with no late tap", async () => {
    const cancellation = new AbortController();
    const harness = await createOperatorHarness({
      runtime: {
        proposals: [{ action: "click", coordinate: [500, 500] }],
        onProposal() {
          cancellation.abort();
        },
      },
    });
    await expect(
      harness.operator.run(harness.task, { signal: cancellation.signal }),
    ).resolves.toMatchObject({ status: "CANCELLED", failure: { code: "OPERATOR_CANCELLED" } });
    expect(harness.backend.calls).toHaveLength(0);
  });

  it("classifies operator crash", async () => {
    const harness = await createOperatorHarness({
      runtime: { proposals: successful, crashAtStep: 1 },
    });
    await expect(harness.operator.run(harness.task)).resolves.toMatchObject({
      status: "FAILED",
      failure: { code: "OPERATOR_CRASH", retryable: true },
    });
  });

  it("classifies model timeout", async () => {
    const harness = await createOperatorHarness({
      runtime: { proposals: successful, delayMs: 100 },
    });
    await expect(
      harness.operator.run({ ...harness.task, limits: { ...harness.task.limits, timeoutMs: 10 } }),
    ).resolves.toMatchObject({ status: "TIMED_OUT", failure: { code: "MODEL_TIMEOUT" } });
  });

  it("fails when the device is offline", async () => {
    const harness = await createOperatorHarness({
      device: { online: false },
      runtime: { proposals: successful },
    });
    await expect(harness.operator.run(harness.task)).resolves.toMatchObject({
      status: "FAILED",
      failure: { code: "DEVICE_OFFLINE" },
    });
  });

  it("allows bounded GUI recovery after one action failure", async () => {
    let harness: Awaited<ReturnType<typeof createOperatorHarness>>;
    harness = await createOperatorHarness({
      device: { failExecution: true },
      runtime: {
        proposals: [
          { action: "open", text: "Settings" },
          { action: "open", text: "Settings" },
          { action: "terminate", status: "success" },
        ],
        onProposal(step) {
          if (step === 2)
            harness.backend.configure("DEVICE-001", {
              online: true,
              initialState: { foregroundApp: "SpringBoard" },
            });
        },
      },
    });
    await expect(harness.operator.run(harness.task)).resolves.toMatchObject({
      status: "SUCCEEDED",
      stepCount: 3,
    });
    expect(harness.backend.calls).toHaveLength(2);
  });

  it("stops at maxSteps", async () => {
    const harness = await createOperatorHarness({
      runtime: {
        proposals: [
          { action: "system_button", button: "Home" },
          { action: "system_button", button: "Home" },
        ],
      },
    });
    await expect(
      harness.operator.run({ ...harness.task, limits: { ...harness.task.limits, maxSteps: 2 } }),
    ).resolves.toMatchObject({ status: "FAILED", failure: { code: "MAX_STEPS_EXCEEDED" } });
  });

  it("enforces whole-task timeout", async () => {
    const harness = await createOperatorHarness({
      runtime: { proposals: [{ action: "wait", time: 1 }, ...successful] },
    });
    await expect(
      harness.operator.run({ ...harness.task, limits: { ...harness.task.limits, timeoutMs: 10 } }),
    ).resolves.toMatchObject({ status: "TIMED_OUT", failure: { code: "TASK_TIMEOUT" } });
  });

  it("does not accept Mobile-Agent done when Fleet verification fails", async () => {
    const harness = await createOperatorHarness({
      device: { failVerification: true },
      runtime: { proposals: [{ action: "terminate", status: "success" }] },
    });
    await expect(
      harness.operator.run({
        ...harness.task,
        limits: { ...harness.task.limits, maxConsecutiveFailures: 1 },
      }),
    ).resolves.toMatchObject({ status: "FAILED", failure: { code: "VERIFICATION_FAILED" } });
  });
});
