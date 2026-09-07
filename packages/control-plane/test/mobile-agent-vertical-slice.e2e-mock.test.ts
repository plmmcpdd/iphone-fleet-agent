import type { WorkflowEngine, WorkflowSubmission } from "@iphone-fleet/application";
import { describe, expect, it } from "vitest";
import { createMa1MockFleetRuntime } from "../src/index.js";

describe("MA1 Control Plane mock vertical slice", () => {
  it("runs Fleet submit through PhoneOperator, adapter, verification and Evidence", async () => {
    const { controlPlane, backend } = createMa1MockFleetRuntime();
    const job = await controlPlane.submit({
      jobId: "JOB-MA1-E2E",
      clientId: "CLIENT-DEMO",
      accountId: "ACCOUNT-DEMO-001",
      deviceId: "DEVICE-MOCK-001",
      networkAssignmentId: "NETWORK-DEMO-001",
      actorId: "ma1-e2e",
      correlationId: "CORR-MA1-E2E",
      action: {
        name: "phone_operator_task",
        parameters: {
          instruction: "Open Settings",
          maxSteps: 5,
          timeoutMs: 5_000,
          policyProfile: "ma1-safe-read-only",
        },
      },
      verification: { name: "state_contains", expected: { foregroundApp: "Settings" } },
      workflowRevision: "ma1-mock-v1",
    });
    expect(job.state).toBe("SUCCEEDED");
    expect(backend.calls.map((call) => call.action.name)).toEqual(["open_app"]);
    await expect(controlPlane.getEvidence(job.jobId)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ step: "phone-operator-terminal", outcome: "SUCCEEDED" }),
      ]),
    );
  });

  it("delegates the PhoneOperator envelope to the configured Hatchet boundary", async () => {
    const submissions: WorkflowSubmission[] = [];
    const workflowEngine: WorkflowEngine = {
      async submit(input) {
        submissions.push(input);
        return { jobId: input.context.jobId, state: "SUCCEEDED" };
      },
      async get() {
        return undefined;
      },
      async signalHumanResolved() {},
    };
    const { controlPlane, backend } = createMa1MockFleetRuntime({ workflowEngine });
    const job = await controlPlane.submit({
      jobId: "JOB-MA1-HATCHET-BOUNDARY",
      clientId: "CLIENT-DEMO",
      accountId: "ACCOUNT-DEMO-001",
      deviceId: "DEVICE-MOCK-001",
      networkAssignmentId: "NETWORK-DEMO-001",
      actorId: "ma1-e2e",
      correlationId: "CORR-MA1-HATCHET-BOUNDARY",
      action: {
        name: "phone_operator_task",
        parameters: { instruction: "Open Settings" },
      },
      verification: { name: "state_contains", expected: { foregroundApp: "Settings" } },
      workflowRevision: "ma1-hatchet-v1",
    });

    expect(job.state).toBe("SUCCEEDED");
    expect(submissions).toHaveLength(1);
    expect(submissions[0]?.context.deviceId).toBe("DEVICE-MOCK-001");
    expect(backend.calls).toHaveLength(0);
    await expect(controlPlane.getEvidence(job.jobId)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          step: "phone-operator-workflow-terminal",
          outcome: "SUCCEEDED",
        }),
      ]),
    );
  });
});
