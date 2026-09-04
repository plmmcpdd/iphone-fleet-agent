import { trace } from "@opentelemetry/api";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { afterAll, describe, expect, it } from "vitest";
import { createMockFleetRuntime } from "../../control-plane/src/mock-runtime.js";

const exporter = new InMemorySpanExporter();
const provider = new BasicTracerProvider({
  spanProcessors: [new SimpleSpanProcessor(exporter)],
});
trace.setGlobalTracerProvider(provider);

afterAll(async () => {
  await provider.shutdown();
});

describe("FleetControlPlane OpenTelemetry integration", () => {
  it("emits action, verification and evidence spans with lease context", async () => {
    const { controlPlane } = createMockFleetRuntime();
    const job = await controlPlane.submit({
      jobId: "JOB-A5-OTEL",
      clientId: "CLIENT-DEMO",
      accountId: "ACCOUNT-DEMO-001",
      deviceId: "DEVICE-MOCK-001",
      networkAssignmentId: "NETWORK-DEMO-001",
      actorId: "A5-TEST",
      correlationId: "CORR-A5-OTEL",
      action: { name: "set_state", parameters: { screen: "audit" } },
      verification: { name: "state_contains", expected: { screen: "audit" } },
      workflowRevision: "mock-a5",
    });
    expect(job.state).toBe("SUCCEEDED");

    const spans = exporter.getFinishedSpans();
    expect(spans.map((span) => span.name)).toEqual([
      "fleet.device.action",
      "fleet.device.verify",
      "fleet.evidence.append",
    ]);
    for (const span of spans) {
      expect(span.attributes).toMatchObject({
        "fleet.jobId": "JOB-A5-OTEL",
        "fleet.clientId": "CLIENT-DEMO",
        "fleet.accountId": "ACCOUNT-DEMO-001",
        "fleet.deviceId": "DEVICE-MOCK-001",
        "fleet.networkAssignmentId": "NETWORK-DEMO-001",
        "fleet.leaseId": expect.stringMatching(/^LEASE-/),
        "fleet.fencingToken": 1,
        "fleet.actorId": "A5-TEST",
        "fleet.correlationId": "CORR-A5-OTEL",
      });
    }
  });
});
