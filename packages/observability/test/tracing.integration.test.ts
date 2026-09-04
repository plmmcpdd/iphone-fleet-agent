import { trace } from "@opentelemetry/api";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { afterAll, describe, expect, it } from "vitest";
import { withFleetSpan } from "../src/index.js";

const exporter = new InMemorySpanExporter();
const provider = new BasicTracerProvider({
  spanProcessors: [new SimpleSpanProcessor(exporter)],
});
trace.setGlobalTracerProvider(provider);

afterAll(async () => {
  await provider.shutdown();
});

describe("vendor-neutral fleet tracing", () => {
  it("exports context-rich success and error spans without a vendor backend", async () => {
    const context = {
      jobId: "JOB-OTEL",
      clientId: "CLIENT-OTEL",
      accountId: "ACCOUNT-OTEL",
      deviceId: "DEVICE-OTEL",
      networkAssignmentId: "NETWORK-OTEL",
      leaseId: "LEASE-OTEL",
      fencingToken: 11,
      actorId: "ACTOR-OTEL",
      correlationId: "CORRELATION-OTEL",
    };
    await expect(
      withFleetSpan("fleet.device.action", context, { "fleet.action.name": "tap" }, async () =>
        Promise.resolve("ok"),
      ),
    ).resolves.toBe("ok");
    await expect(
      withFleetSpan("fleet.device.verify", context, {}, async () => {
        throw new Error("injected verification failure");
      }),
    ).rejects.toThrow("injected verification failure");

    const spans = exporter.getFinishedSpans();
    expect(spans.map((span) => span.name)).toEqual(["fleet.device.action", "fleet.device.verify"]);
    expect(spans[0]?.attributes).toMatchObject({
      "fleet.jobId": "JOB-OTEL",
      "fleet.deviceId": "DEVICE-OTEL",
      "fleet.leaseId": "LEASE-OTEL",
      "fleet.fencingToken": 11,
      "fleet.action.name": "tap",
    });
    expect(spans[1]?.status.code).toBe(2);
    expect(spans[1]?.events.some((event) => event.name === "exception")).toBe(true);
  });
});
