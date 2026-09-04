import type { DeviceLeaseStore, RegistryReader } from "@iphone-fleet/application";
import { createMockFleetRuntime, FleetControlPlane } from "@iphone-fleet/control-plane";
import { describe, expect, it } from "vitest";

const jobInput = (jobId: string) => ({
  jobId,
  clientId: "CLIENT-DEMO",
  accountId: "ACCOUNT-DEMO-001",
  deviceId: "DEVICE-MOCK-001",
  networkAssignmentId: "NETWORK-DEMO-001",
  actorId: "e2e-mock",
  correlationId: `CORR-${jobId}`,
  action: { name: "set_state", parameters: { screen: "settings" } },
  verification: { name: "state_contains", expected: { screen: "settings" } },
  workflowRevision: "mock-v1",
});

function withInjectedLease(mode: "expired" | "stale") {
  const runtime = createMockFleetRuntime();
  const leases: DeviceLeaseStore = {
    async acquire(request) {
      const lease = await runtime.leases.acquire(request);
      if (mode === "expired") runtime.leases.expireActive(request.deviceId);
      else runtime.leases.supersedeActive(request.deviceId);
      return lease;
    },
    renew: (context, ttlMs) => runtime.leases.renew(context, ttlMs),
    validate: (context) => runtime.leases.validate(context),
    release: (context) => runtime.leases.release(context),
  };
  return {
    ...runtime,
    controlPlane: new FleetControlPlane({ ...runtime, leases }),
  };
}

function withRegistry(registry: RegistryReader) {
  const runtime = createMockFleetRuntime();
  return {
    ...runtime,
    controlPlane: new FleetControlPlane({ ...runtime, registry }),
  };
}

async function expectFailedWithEvidence(
  runtime: ReturnType<typeof createMockFleetRuntime>,
  jobId: string,
  code: string,
) {
  const job = await runtime.controlPlane.submit(jobInput(jobId));
  expect(job).toMatchObject({ state: "FAILED", error: { code } });
  const evidence = await runtime.controlPlane.getEvidence(jobId);
  expect(evidence.length).toBeGreaterThan(0);
  expect(evidence.at(-1)?.outcome).toBe("FAILED");
}

describe("A2 mock vertical slice", () => {
  it("runs submit → resolve → lease → action → verify → evidence → release", async () => {
    const runtime = createMockFleetRuntime();
    const job = await runtime.controlPlane.submit(jobInput("JOB-E2E-001"));
    expect(job.state).toBe("SUCCEEDED");
    expect(runtime.backend.calls).toHaveLength(1);
    expect(runtime.backend.calls[0]?.context.deviceId).toBe("DEVICE-MOCK-001");
    expect(await runtime.controlPlane.getEvidence(job.jobId)).toHaveLength(1);
    if (!job.context) throw new Error("successful job must retain ExecutionContext");
    await expect(runtime.leases.validate(job.context)).resolves.toEqual({
      valid: false,
      reason: "MISSING",
    });
  });

  it("fails closed with evidence for expired and stale leases", async () => {
    await expectFailedWithEvidence(withInjectedLease("expired"), "JOB-EXPIRED", "LEASE_EXPIRED");
    await expectFailedWithEvidence(withInjectedLease("stale"), "JOB-STALE", "STALE_FENCING_TOKEN");
  });

  it("fails closed with evidence for wrong device", async () => {
    const base = createMockFleetRuntime();
    const registry: RegistryReader = {
      ...base.registry,
      getDevice: async () => ({
        id: "DEVICE-OTHER",
        clientId: "CLIENT-DEMO",
        accountId: "ACCOUNT-DEMO-001",
        networkAssignmentId: "NETWORK-DEMO-001",
        state: "READY",
      }),
      getAccount: (id) => base.registry.getAccount(id),
      getNetworkAssignment: (id) => base.registry.getNetworkAssignment(id),
      listDevices: () => base.registry.listDevices(),
      findDevice: (input) => base.registry.findDevice(input),
    };
    await expectFailedWithEvidence(withRegistry(registry), "JOB-WRONG-DEVICE", "WRONG_DEVICE");
  });

  it("fails closed with evidence for wrong account and network assignment", async () => {
    const wrongAccount = createMockFleetRuntime();
    wrongAccount.registry.setAccount({
      id: "ACCOUNT-DEMO-001",
      clientId: "CLIENT-DEMO",
      assignedDeviceId: "DEVICE-OTHER",
      networkAssignmentId: "NETWORK-DEMO-001",
      state: "READY",
    });
    await expectFailedWithEvidence(wrongAccount, "JOB-WRONG-ACCOUNT", "WRONG_ACCOUNT");

    const wrongNetwork = createMockFleetRuntime();
    wrongNetwork.registry.setNetworkAssignment({
      id: "NETWORK-DEMO-001",
      clientId: "CLIENT-DEMO",
      accountId: "ACCOUNT-DEMO-001",
      deviceId: "DEVICE-OTHER",
      state: "READY",
    });
    await expectFailedWithEvidence(wrongNetwork, "JOB-WRONG-NETWORK", "WRONG_NETWORK_ASSIGNMENT");
  });

  it("fails closed with evidence for device offline and verification failure", async () => {
    const offline = createMockFleetRuntime();
    offline.backend.configure("DEVICE-MOCK-001", { online: false });
    await expectFailedWithEvidence(offline, "JOB-OFFLINE", "DEVICE_OFFLINE");

    const verification = createMockFleetRuntime();
    verification.backend.configure("DEVICE-MOCK-001", { online: true, failVerification: true });
    await expectFailedWithEvidence(verification, "JOB-VERIFY-FAIL", "VERIFICATION_FAILED");
  });

  it("never returns success when evidence persistence fails", async () => {
    const runtime = createMockFleetRuntime();
    const controlPlane = new FleetControlPlane({
      ...runtime,
      evidence: {
        async append() {
          throw new Error("Injected evidence persistence failure");
        },
        async listByJob() {
          return [];
        },
      },
    });
    await expect(controlPlane.submit(jobInput("JOB-EVIDENCE-FAIL"))).rejects.toThrow(
      "Injected evidence persistence failure",
    );
    expect(controlPlane.getJob("JOB-EVIDENCE-FAIL")?.state).not.toBe("SUCCEEDED");
  });

  it("does not return success when lease release fails", async () => {
    const runtime = createMockFleetRuntime();
    const leases: DeviceLeaseStore = {
      acquire: (request) => runtime.leases.acquire(request),
      renew: (context, ttlMs) => runtime.leases.renew(context, ttlMs),
      validate: (context) => runtime.leases.validate(context),
      async release() {
        throw new Error("Injected release failure");
      },
    };
    const controlPlane = new FleetControlPlane({ ...runtime, leases });
    const job = await controlPlane.submit(jobInput("JOB-RELEASE-FAIL"));
    expect(job.state).toBe("FAILED");
    expect(job.error?.message).toBe("Injected release failure");
    expect(await controlPlane.getEvidence(job.jobId)).toHaveLength(2);
  });
});
