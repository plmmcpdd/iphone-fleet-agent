import { randomUUID } from "node:crypto";
import type {
  DeviceLease,
  DeviceLeaseStore,
  LeaseAcquireRequest,
  LeaseValidation,
} from "@iphone-fleet/application";
import type { DeviceId, ExecutionContext } from "@iphone-fleet/contracts";
import { FleetError } from "@iphone-fleet/domain";
import type { Clock } from "./clock.js";
import { SystemClock } from "./clock.js";

export class InMemoryDeviceLeaseStore implements DeviceLeaseStore {
  private readonly active = new Map<DeviceId, DeviceLease>();
  private readonly nextTokens = new Map<DeviceId, number>();

  public constructor(private readonly clock: Clock = new SystemClock()) {}

  public async acquire(request: LeaseAcquireRequest): Promise<DeviceLease> {
    if (!Number.isInteger(request.ttlMs) || request.ttlMs <= 0) {
      throw new FleetError("LEASE_REQUIRED", "Lease TTL must be a positive integer");
    }
    const current = this.active.get(request.deviceId);
    if (current && Date.parse(current.expiresAt) > this.clock.now().getTime()) {
      throw new FleetError("DEVICE_ALREADY_LEASED", `Device ${request.deviceId} is already leased`);
    }
    const fencingToken = (this.nextTokens.get(request.deviceId) ?? 0) + 1;
    this.nextTokens.set(request.deviceId, fencingToken);
    const lease: DeviceLease = {
      ...request,
      leaseId: `LEASE-${randomUUID()}`,
      fencingToken,
      expiresAt: new Date(this.clock.now().getTime() + request.ttlMs).toISOString(),
    };
    this.active.set(request.deviceId, lease);
    return lease;
  }

  public async renew(context: ExecutionContext, ttlMs: number): Promise<DeviceLease> {
    const validation = await this.validate(context);
    if (!validation.valid) {
      throw this.validationError(validation.reason);
    }
    const renewed = {
      ...validation.lease,
      expiresAt: new Date(this.clock.now().getTime() + ttlMs).toISOString(),
    };
    this.active.set(context.deviceId, renewed);
    return renewed;
  }

  public async validate(context: ExecutionContext): Promise<LeaseValidation> {
    const lease = this.active.get(context.deviceId);
    if (!lease) return { valid: false, reason: "MISSING" };
    if (Date.parse(lease.expiresAt) <= this.clock.now().getTime()) {
      return { valid: false, reason: "EXPIRED" };
    }
    if (context.fencingToken !== lease.fencingToken) {
      return context.fencingToken < lease.fencingToken
        ? { valid: false, reason: "STALE_FENCING_TOKEN" }
        : { valid: false, reason: "CONTEXT_MISMATCH" };
    }
    const fields = [
      "leaseId",
      "jobId",
      "clientId",
      "accountId",
      "deviceId",
      "networkAssignmentId",
      "actorId",
      "correlationId",
    ] as const;
    if (fields.some((field) => context[field] !== lease[field])) {
      return { valid: false, reason: "CONTEXT_MISMATCH" };
    }
    return { valid: true, lease };
  }

  public async release(context: ExecutionContext): Promise<void> {
    const validation = await this.validate(context);
    if (!validation.valid) throw this.validationError(validation.reason);
    this.active.delete(context.deviceId);
  }

  public expireActive(deviceId: DeviceId): void {
    const lease = this.active.get(deviceId);
    if (lease) this.active.set(deviceId, { ...lease, expiresAt: this.clock.now().toISOString() });
  }

  public supersedeActive(deviceId: DeviceId): void {
    const lease = this.active.get(deviceId);
    if (!lease) return;
    const fencingToken = lease.fencingToken + 1;
    this.nextTokens.set(deviceId, fencingToken);
    this.active.set(deviceId, {
      ...lease,
      leaseId: `LEASE-${randomUUID()}`,
      fencingToken,
    });
  }

  private validationError(reason: Exclude<LeaseValidation, { valid: true }>["reason"]): FleetError {
    const code = {
      MISSING: "LEASE_REQUIRED",
      EXPIRED: "LEASE_EXPIRED",
      STALE_FENCING_TOKEN: "STALE_FENCING_TOKEN",
      CONTEXT_MISMATCH: "LEASE_CONTEXT_MISMATCH",
    } as const;
    return new FleetError(code[reason], `Lease validation failed: ${reason}`);
  }
}
