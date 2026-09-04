import {
  type DeviceAction,
  DeviceActionSchema,
  type ExecutionContext,
  ExecutionContextSchema,
} from "@iphone-fleet/contracts";
import {
  type AccountRecord,
  type DeviceRecord,
  FleetError,
  type NetworkAssignmentRecord,
  type PolicyEvaluator,
} from "@iphone-fleet/domain";
import type { DeviceLeaseStore } from "./ports.js";

export interface DeviceAuthorizationInput {
  readonly context: ExecutionContext;
  readonly action: DeviceAction;
  readonly device: DeviceRecord;
  readonly account: AccountRecord;
  readonly network: NetworkAssignmentRecord;
  readonly leaseStore: DeviceLeaseStore;
  readonly policy: PolicyEvaluator;
}

export async function authorizeDeviceAction(input: DeviceAuthorizationInput): Promise<void> {
  const contextResult = ExecutionContextSchema.safeParse(input.context);
  if (!contextResult.success) {
    throw new FleetError("INVALID_EXECUTION_CONTEXT", "ExecutionContext is invalid", {
      issues: contextResult.error.issues,
    });
  }
  const context = contextResult.data;
  const action = DeviceActionSchema.parse(input.action);

  if (input.device.id !== context.deviceId) {
    throw new FleetError("WRONG_DEVICE", "ExecutionContext does not target this device");
  }
  if (
    input.account.id !== context.accountId ||
    input.device.accountId !== context.accountId ||
    input.account.assignedDeviceId !== context.deviceId
  ) {
    throw new FleetError("WRONG_ACCOUNT", "Account assignment does not match ExecutionContext");
  }
  if (
    input.network.id !== context.networkAssignmentId ||
    input.device.networkAssignmentId !== context.networkAssignmentId ||
    input.account.networkAssignmentId !== context.networkAssignmentId ||
    input.network.deviceId !== context.deviceId ||
    input.network.accountId !== context.accountId
  ) {
    throw new FleetError(
      "WRONG_NETWORK_ASSIGNMENT",
      "Network assignment does not match ExecutionContext",
    );
  }
  if (
    input.device.clientId !== context.clientId ||
    input.account.clientId !== context.clientId ||
    input.network.clientId !== context.clientId
  ) {
    throw new FleetError("CONTEXT_MISMATCH", "Client boundary does not match ExecutionContext");
  }
  if (!(["READY", "BUSY"] as const).includes(input.device.state as "READY" | "BUSY")) {
    throw new FleetError(
      input.device.state === "OFFLINE" ? "DEVICE_OFFLINE" : "DEVICE_NOT_ACTIONABLE",
      `Device state ${input.device.state} is not actionable`,
    );
  }
  if (!(["READY", "ACTIVE"] as const).includes(input.account.state as "READY" | "ACTIVE")) {
    throw new FleetError(
      "ACCOUNT_NOT_ACTIONABLE",
      `Account state ${input.account.state} is not actionable`,
    );
  }
  if (input.network.state !== "READY") {
    throw new FleetError(
      "NETWORK_NOT_ACTIONABLE",
      `Network state ${input.network.state} is not actionable`,
    );
  }

  const lease = await input.leaseStore.validate(context);
  if (!lease.valid) {
    const mapping = {
      MISSING: "LEASE_REQUIRED",
      EXPIRED: "LEASE_EXPIRED",
      STALE_FENCING_TOKEN: "STALE_FENCING_TOKEN",
      CONTEXT_MISMATCH: "LEASE_CONTEXT_MISMATCH",
    } as const;
    throw new FleetError(mapping[lease.reason], `Lease validation failed: ${lease.reason}`);
  }

  const decision = await input.policy.evaluate(context, action);
  if (decision.outcome === "DENY") {
    throw new FleetError("POLICY_DENIED", decision.reason);
  }
  if (decision.outcome === "REQUIRE_HUMAN") {
    throw new FleetError("HUMAN_REQUIRED", decision.reason);
  }
}
