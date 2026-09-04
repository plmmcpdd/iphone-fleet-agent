import type {
  DeviceAction,
  DeviceActionResult,
  DeviceId,
  DeviceVerification,
  DeviceVerificationResult,
  ExecutionContext,
  JobId,
} from "@iphone-fleet/contracts";
import type { AccountRecord, DeviceRecord, NetworkAssignmentRecord } from "@iphone-fleet/domain";

export interface DeviceBackend {
  health(deviceId: DeviceId): Promise<{ readonly online: boolean; readonly observedAt: string }>;
  execute(context: ExecutionContext, action: DeviceAction): Promise<DeviceActionResult>;
  verify(
    context: ExecutionContext,
    verification: DeviceVerification,
  ): Promise<DeviceVerificationResult>;
}

export interface LeaseAcquireRequest {
  readonly jobId: JobId;
  readonly clientId: ExecutionContext["clientId"];
  readonly accountId: ExecutionContext["accountId"];
  readonly deviceId: DeviceId;
  readonly networkAssignmentId: ExecutionContext["networkAssignmentId"];
  readonly actorId: ExecutionContext["actorId"];
  readonly correlationId: ExecutionContext["correlationId"];
  readonly ttlMs: number;
}

export interface DeviceLease {
  readonly leaseId: ExecutionContext["leaseId"];
  readonly jobId: JobId;
  readonly clientId: ExecutionContext["clientId"];
  readonly accountId: ExecutionContext["accountId"];
  readonly deviceId: DeviceId;
  readonly networkAssignmentId: ExecutionContext["networkAssignmentId"];
  readonly actorId: ExecutionContext["actorId"];
  readonly correlationId: ExecutionContext["correlationId"];
  readonly fencingToken: number;
  readonly expiresAt: string;
}

export type LeaseInvalidReason = "MISSING" | "EXPIRED" | "STALE_FENCING_TOKEN" | "CONTEXT_MISMATCH";

export type LeaseValidation =
  | { readonly valid: true; readonly lease: DeviceLease }
  | { readonly valid: false; readonly reason: LeaseInvalidReason };

export interface DeviceLeaseStore {
  acquire(request: LeaseAcquireRequest): Promise<DeviceLease>;
  renew(context: ExecutionContext, ttlMs: number): Promise<DeviceLease>;
  validate(context: ExecutionContext): Promise<LeaseValidation>;
  release(context: ExecutionContext): Promise<void>;
}

export interface EvidenceRecord {
  readonly evidenceId: string;
  readonly context: ExecutionContext;
  readonly workflowRevision: string;
  readonly step: string;
  readonly timestamp: string;
  readonly outcome: "SUCCEEDED" | "FAILED" | "NEEDS_HUMAN";
  readonly artifactPath?: string;
  readonly artifactDigest?: string;
  readonly details: Readonly<Record<string, unknown>>;
}

export interface EvidenceSink {
  append(record: EvidenceRecord): Promise<void>;
  listByJob(jobId: JobId): Promise<readonly EvidenceRecord[]>;
}

export interface WorkflowSubmission {
  readonly context: Omit<ExecutionContext, "leaseId" | "fencingToken">;
  readonly action: DeviceAction;
  readonly verification: DeviceVerification;
  readonly workflowRevision: string;
}

export interface WorkflowRun {
  readonly jobId: JobId;
  readonly state: "QUEUED" | "RUNNING" | "NEEDS_HUMAN" | "SUCCEEDED" | "FAILED";
}

export interface WorkflowEngine {
  submit(input: WorkflowSubmission): Promise<WorkflowRun>;
  get(jobId: JobId): Promise<WorkflowRun | undefined>;
  signalHumanResolved(jobId: JobId, actorId: string): Promise<void>;
}

export interface RegistryReader {
  getDevice(deviceId: DeviceId): Promise<DeviceRecord | undefined>;
  getAccount(accountId: ExecutionContext["accountId"]): Promise<AccountRecord | undefined>;
  getNetworkAssignment(
    networkAssignmentId: ExecutionContext["networkAssignmentId"],
  ): Promise<NetworkAssignmentRecord | undefined>;
  listDevices(): Promise<readonly DeviceRecord[]>;
  findDevice(input: {
    readonly clientId: ExecutionContext["clientId"];
    readonly accountId: ExecutionContext["accountId"];
    readonly networkAssignmentId: ExecutionContext["networkAssignmentId"];
  }): Promise<DeviceRecord | undefined>;
}
