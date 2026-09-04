import type { ExecutionContext } from "@iphone-fleet/contracts";
import { describe, expect, it } from "vitest";
import { InMemoryDeviceLeaseStore, MutableClock } from "../src/index.js";

const request = {
  jobId: "JOB-001",
  clientId: "CLIENT-001",
  accountId: "ACCOUNT-001",
  deviceId: "DEVICE-001",
  networkAssignmentId: "NETWORK-001",
  actorId: "ACTOR-001",
  correlationId: "CORR-001",
  ttlMs: 1_000,
};

const toContext = (
  lease: Awaited<ReturnType<InMemoryDeviceLeaseStore["acquire"]>>,
): ExecutionContext => ({
  jobId: lease.jobId,
  clientId: lease.clientId,
  accountId: lease.accountId,
  deviceId: lease.deviceId,
  networkAssignmentId: lease.networkAssignmentId,
  leaseId: lease.leaseId,
  fencingToken: lease.fencingToken,
  actorId: lease.actorId,
  correlationId: lease.correlationId,
});

describe("InMemoryDeviceLeaseStore contract", () => {
  it("allows only one concurrent acquisition for a device", async () => {
    const store = new InMemoryDeviceLeaseStore();
    const results = await Promise.allSettled([
      store.acquire(request),
      store.acquire({ ...request, jobId: "JOB-002" }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });

  it("rejects expired leases", async () => {
    const clock = new MutableClock(new Date("2026-09-04T00:00:00.000Z"));
    const store = new InMemoryDeviceLeaseStore(clock);
    const lease = await store.acquire(request);
    clock.advance(1_000);
    await expect(store.validate(toContext(lease))).resolves.toEqual({
      valid: false,
      reason: "EXPIRED",
    });
  });

  it("rejects stale tokens after a successor lease and increases tokens monotonically", async () => {
    const clock = new MutableClock(new Date("2026-09-04T00:00:00.000Z"));
    const store = new InMemoryDeviceLeaseStore(clock);
    const first = await store.acquire(request);
    clock.advance(1_000);
    const second = await store.acquire({ ...request, jobId: "JOB-002" });
    expect(second.fencingToken).toBe(first.fencingToken + 1);
    await expect(store.validate(toContext(first))).resolves.toEqual({
      valid: false,
      reason: "STALE_FENCING_TOKEN",
    });
  });

  it("rejects context mismatches and release with an old lease", async () => {
    const store = new InMemoryDeviceLeaseStore();
    const lease = await store.acquire(request);
    const context = toContext(lease);
    await expect(store.validate({ ...context, accountId: "ACCOUNT-OTHER" })).resolves.toEqual({
      valid: false,
      reason: "CONTEXT_MISMATCH",
    });
    store.supersedeActive(context.deviceId);
    await expect(store.release(context)).rejects.toMatchObject({ code: "STALE_FENCING_TOKEN" });
  });
});
