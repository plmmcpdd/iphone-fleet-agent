import { randomUUID } from "node:crypto";
import {
  authorizeDeviceAction,
  type DeviceBackend,
  type DeviceLeaseStore,
  type EvidenceSink,
  type RegistryReader,
} from "@iphone-fleet/application";
import type {
  DeviceAction,
  DeviceActionResult,
  DeviceVerification,
  DeviceVerificationResult,
  ExecutionContext,
  PhoneObservation,
} from "@iphone-fleet/contracts";
import { ExecutionContextSchema } from "@iphone-fleet/contracts";
import { FleetError, type PolicyEvaluator } from "@iphone-fleet/domain";

export interface OperatorAuditIdentity {
  readonly operator: "mobile-agent-v3.5";
  readonly upstreamSha: string;
  readonly model: string;
  readonly workflowRevision: string;
}

export interface FleetDeviceAdapterDependencies {
  readonly context: ExecutionContext;
  readonly registry: RegistryReader;
  readonly leases: DeviceLeaseStore;
  readonly policy: PolicyEvaluator;
  readonly backend: DeviceBackend;
  readonly evidence: EvidenceSink;
  readonly audit: OperatorAuditIdentity;
  readonly now?: () => Date;
}

export class FleetDeviceAdapter {
  public readonly context: ExecutionContext;
  private readonly now: () => Date;

  public constructor(private readonly dependencies: FleetDeviceAdapterDependencies) {
    this.context = ExecutionContextSchema.parse(dependencies.context);
    this.now = dependencies.now ?? (() => new Date());
  }

  public async observe(stepNumber: number): Promise<PhoneObservation> {
    await this.requireBindingAndLease();
    const health = await this.dependencies.backend.health(this.context.deviceId);
    if (!health.online) throw new FleetError("DEVICE_OFFLINE", "Device backend reports offline");
    try {
      return await this.dependencies.backend.observe(this.context);
    } catch (error) {
      if (error instanceof FleetError) throw error;
      throw new FleetError("OBSERVATION_FAILED", "Phone observation failed", {
        stepNumber,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  public async execute(
    stepNumber: number,
    action: DeviceAction,
    details: Readonly<Record<string, unknown>>,
  ): Promise<{ readonly result: DeviceActionResult; readonly evidenceId: string }> {
    const evidenceId = `EVIDENCE-${randomUUID()}`;
    const startedAt = Date.now();
    try {
      const binding = await this.requireBinding();
      await authorizeDeviceAction({
        context: this.context,
        action,
        ...binding,
        leaseStore: this.dependencies.leases,
        policy: this.dependencies.policy,
      });
      const health = await this.dependencies.backend.health(this.context.deviceId);
      if (!health.online) throw new FleetError("DEVICE_OFFLINE", "Device backend reports offline");
      const result = await this.dependencies.backend.execute(this.context, action);
      if (result.outcome !== "SUCCEEDED") {
        throw new FleetError("ACTION_FAILED", result.message ?? "Device action failed");
      }
      await this.dependencies.evidence.append({
        evidenceId,
        context: this.context,
        workflowRevision: this.dependencies.audit.workflowRevision,
        step: `phone-operator-${stepNumber}`,
        timestamp: this.now().toISOString(),
        outcome: result.outcome,
        details: this.auditDetails(stepNumber, action, {
          ...details,
          policyResult: "ALLOW",
          leaseValidationResult: "VALID",
          deviceActionResult: result,
          latencyMs: Date.now() - startedAt,
        }),
      });
      return { result, evidenceId };
    } catch (error) {
      const failure = normalizeFailure(error);
      await this.dependencies.evidence.append({
        evidenceId,
        context: this.context,
        workflowRevision: this.dependencies.audit.workflowRevision,
        step: `phone-operator-${stepNumber}`,
        timestamp: this.now().toISOString(),
        outcome: failure.code === "HUMAN_REQUIRED" ? "NEEDS_HUMAN" : "FAILED",
        details: this.auditDetails(stepNumber, action, {
          ...details,
          deviceActionResult: "NOT_EXECUTED_OR_FAILED",
          failure,
          latencyMs: Date.now() - startedAt,
        }),
      });
      throw error;
    }
  }

  public async recordDecision(
    stepNumber: number,
    outcome: "SUCCEEDED" | "FAILED" | "NEEDS_HUMAN",
    details: Readonly<Record<string, unknown>>,
  ): Promise<string> {
    const evidenceId = `EVIDENCE-${randomUUID()}`;
    await this.dependencies.evidence.append({
      evidenceId,
      context: this.context,
      workflowRevision: this.dependencies.audit.workflowRevision,
      step: `phone-operator-${stepNumber}`,
      timestamp: this.now().toISOString(),
      outcome,
      details: {
        operator: this.dependencies.audit.operator,
        operatorUpstreamSha: this.dependencies.audit.upstreamSha,
        model: this.dependencies.audit.model,
        stepNumber,
        ...details,
      },
    });
    return evidenceId;
  }

  public async verify(verification: DeviceVerification): Promise<DeviceVerificationResult> {
    await this.requireBindingAndLease();
    return this.dependencies.backend.verify(this.context, verification);
  }

  private async requireBindingAndLease(): Promise<void> {
    await this.requireBinding();
    const lease = await this.dependencies.leases.validate(this.context);
    if (!lease.valid) {
      const codes = {
        MISSING: "LEASE_REQUIRED",
        EXPIRED: "LEASE_EXPIRED",
        STALE_FENCING_TOKEN: "STALE_FENCING_TOKEN",
        CONTEXT_MISMATCH: "LEASE_CONTEXT_MISMATCH",
      } as const;
      throw new FleetError(codes[lease.reason], `Lease validation failed: ${lease.reason}`);
    }
  }

  private async requireBinding() {
    const [device, account, network] = await Promise.all([
      this.dependencies.registry.getDevice(this.context.deviceId),
      this.dependencies.registry.getAccount(this.context.accountId),
      this.dependencies.registry.getNetworkAssignment(this.context.networkAssignmentId),
    ]);
    if (!device || !account || !network) {
      throw new FleetError("CONTEXT_MISMATCH", "Operator binding is not present in Registry");
    }
    return { device, account, network };
  }

  private auditDetails(
    stepNumber: number,
    action: DeviceAction,
    details: Readonly<Record<string, unknown>>,
  ) {
    return {
      operator: this.dependencies.audit.operator,
      operatorUpstreamSha: this.dependencies.audit.upstreamSha,
      model: this.dependencies.audit.model,
      stepNumber,
      normalizedAction: action,
      ...details,
    };
  }
}

function normalizeFailure(error: unknown): { code: string; message: string } {
  if (error instanceof FleetError) return { code: error.code, message: error.message };
  return {
    code: "DEVICE_BACKEND_ERROR",
    message: error instanceof Error ? error.message : String(error),
  };
}
