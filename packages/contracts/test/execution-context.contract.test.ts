import { describe, expect, it } from "vitest";
import { ExecutionContextSchema } from "../src/index.js";

const validContext = {
  jobId: "JOB-001",
  clientId: "CLIENT-001",
  accountId: "ACCOUNT-001",
  deviceId: "DEVICE-001",
  networkAssignmentId: "NETWORK-001",
  leaseId: "LEASE-001",
  fencingToken: 1,
  actorId: "ACTOR-001",
  correlationId: "CORR-001",
};

describe("ExecutionContext contract", () => {
  it("requires all nine frozen fields", () => {
    expect(ExecutionContextSchema.parse(validContext)).toEqual(validContext);
    for (const key of Object.keys(validContext)) {
      const incomplete = { ...validContext } as Record<string, unknown>;
      delete incomplete[key];
      expect(ExecutionContextSchema.safeParse(incomplete).success, key).toBe(false);
    }
  });

  it("rejects empty deviceId and non-positive fencing tokens", () => {
    expect(ExecutionContextSchema.safeParse({ ...validContext, deviceId: "" }).success).toBe(false);
    expect(ExecutionContextSchema.safeParse({ ...validContext, fencingToken: 0 }).success).toBe(
      false,
    );
  });

  it("rejects undeclared fields at the public boundary", () => {
    expect(ExecutionContextSchema.safeParse({ ...validContext, hiddenBypass: true }).success).toBe(
      false,
    );
  });
});
