import type { DeviceAction, ExecutionContext } from "@iphone-fleet/contracts";
import type {
  AccountRecord,
  DeviceRecord,
  NetworkAssignmentRecord,
  PolicyEvaluator,
} from "@iphone-fleet/domain";
import { FleetError } from "@iphone-fleet/domain";
import { describe, expect, it } from "vitest";
import { authorizeDeviceAction } from "../src/authorize-device-action.js";
import type { DeviceLeaseStore, LeaseValidation } from "../src/ports.js";

const context: ExecutionContext = {
  jobId: "JOB-001",
  clientId: "CLIENT-001",
  accountId: "ACCOUNT-001",
  deviceId: "DEVICE-001",
  networkAssignmentId: "NETWORK-001",
  leaseId: "LEASE-001",
  fencingToken: 7,
  actorId: "ACTOR-001",
  correlationId: "CORR-001",
};
const action: DeviceAction = { name: "observe", parameters: {} };
const device: DeviceRecord = {
  id: context.deviceId,
  clientId: context.clientId,
  accountId: context.accountId,
  networkAssignmentId: context.networkAssignmentId,
  state: "READY",
};
const account: AccountRecord = {
  id: context.accountId,
  clientId: context.clientId,
  assignedDeviceId: context.deviceId,
  networkAssignmentId: context.networkAssignmentId,
  state: "READY",
};
const network: NetworkAssignmentRecord = {
  id: context.networkAssignmentId,
  clientId: context.clientId,
  accountId: context.accountId,
  deviceId: context.deviceId,
  state: "READY",
};
const policy: PolicyEvaluator = {
  async evaluate() {
    return { outcome: "ALLOW", reason: "test allow-list" };
  },
};

const leaseStore = (validation: LeaseValidation): DeviceLeaseStore => ({
  async acquire() {
    throw new Error("not used");
  },
  async renew() {
    throw new Error("not used");
  },
  async validate() {
    return validation;
  },
  async release() {},
});

async function expectFleetCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ name: "FleetError", code });
}

describe("device action authorization contract", () => {
  const validLease: LeaseValidation = {
    valid: true,
    lease: { ...context, expiresAt: new Date(Date.now() + 60_000).toISOString() },
  };

  it("allows a fully matching, leased and policy-approved action", async () => {
    await expect(
      authorizeDeviceAction({
        context,
        action,
        device,
        account,
        network,
        policy,
        leaseStore: leaseStore(validLease),
      }),
    ).resolves.toBeUndefined();
  });

  it("fails closed when the lease is missing", async () => {
    await expectFleetCode(
      authorizeDeviceAction({
        context,
        action,
        device,
        account,
        network,
        policy,
        leaseStore: leaseStore({ valid: false, reason: "MISSING" }),
      }),
      "LEASE_REQUIRED",
    );
  });

  it("fails closed for stale fencing tokens", async () => {
    await expectFleetCode(
      authorizeDeviceAction({
        context,
        action,
        device,
        account,
        network,
        policy,
        leaseStore: leaseStore({ valid: false, reason: "STALE_FENCING_TOKEN" }),
      }),
      "STALE_FENCING_TOKEN",
    );
  });

  it("rejects wrong device, account, network and client boundaries", async () => {
    const base = {
      context,
      action,
      device,
      account,
      network,
      policy,
      leaseStore: leaseStore(validLease),
    };
    await expectFleetCode(
      authorizeDeviceAction({ ...base, device: { ...device, id: "DEVICE-OTHER" } }),
      "WRONG_DEVICE",
    );
    await expectFleetCode(
      authorizeDeviceAction({ ...base, account: { ...account, id: "ACCOUNT-OTHER" } }),
      "WRONG_ACCOUNT",
    );
    await expectFleetCode(
      authorizeDeviceAction({ ...base, network: { ...network, id: "NETWORK-OTHER" } }),
      "WRONG_NETWORK_ASSIGNMENT",
    );
    await expectFleetCode(
      authorizeDeviceAction({ ...base, device: { ...device, clientId: "CLIENT-OTHER" } }),
      "CONTEXT_MISMATCH",
    );
  });

  it("rejects offline device state before invoking the backend", async () => {
    await expectFleetCode(
      authorizeDeviceAction({
        context,
        action,
        device: { ...device, state: "OFFLINE" },
        account,
        network,
        policy,
        leaseStore: leaseStore(validLease),
      }),
      "DEVICE_OFFLINE",
    );
  });

  it("uses a deny-by-default policy result", async () => {
    const denying: PolicyEvaluator = {
      async evaluate() {
        return { outcome: "DENY", reason: "not allowed" };
      },
    };
    await expectFleetCode(
      authorizeDeviceAction({
        context,
        action,
        device,
        account,
        network,
        policy: denying,
        leaseStore: leaseStore(validLease),
      }),
      "POLICY_DENIED",
    );
  });

  it("exposes failures as typed FleetError values", async () => {
    try {
      await authorizeDeviceAction({
        context,
        action,
        device,
        account,
        network,
        policy,
        leaseStore: leaseStore({ valid: false, reason: "EXPIRED" }),
      });
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toBeInstanceOf(FleetError);
      expect((error as FleetError).code).toBe("LEASE_EXPIRED");
    }
  });
});
