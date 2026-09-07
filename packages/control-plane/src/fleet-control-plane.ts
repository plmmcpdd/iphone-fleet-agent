import { randomUUID } from "node:crypto";
import {
  authorizeDeviceAction,
  type DeviceBackend,
  type DeviceLeaseStore,
  type EvidenceRecord,
  type EvidenceSink,
  type RegistryReader,
} from "@iphone-fleet/application";
import type {
  DeviceAction,
  DeviceVerification,
  ExecutionContext,
  JobId,
} from "@iphone-fleet/contracts";
import { FleetError, type PolicyEvaluator } from "@iphone-fleet/domain";
import type { Clock } from "@iphone-fleet/inmemory";
import { SystemClock } from "@iphone-fleet/inmemory";
import { withFleetSpan } from "@iphone-fleet/observability";

export interface SubmitFleetJob {
  readonly jobId: JobId;
  readonly clientId: ExecutionContext["clientId"];
  readonly accountId: ExecutionContext["accountId"];
  readonly deviceId: ExecutionContext["deviceId"];
  readonly networkAssignmentId: ExecutionContext["networkAssignmentId"];
  readonly actorId: ExecutionContext["actorId"];
  readonly correlationId: ExecutionContext["correlationId"];
  readonly action: DeviceAction;
  readonly verification: DeviceVerification;
  readonly workflowRevision: string;
  readonly leaseTtlMs?: number;
}

export type FleetJobState = "QUEUED" | "RUNNING" | "NEEDS_HUMAN" | "SUCCEEDED" | "FAILED";

export interface FleetJob {
  readonly jobId: JobId;
  readonly state: FleetJobState;
  readonly submittedAt: string;
  readonly updatedAt: string;
  readonly input: SubmitFleetJob;
  readonly context?: ExecutionContext;
  readonly error?: { readonly code: string; readonly message: string };
}

export class InMemoryFleetJobStore {
  private readonly jobs = new Map<JobId, FleetJob>();

  public set(job: FleetJob): void {
    this.jobs.set(job.jobId, structuredClone(job));
  }

  public get(jobId: JobId): FleetJob | undefined {
    const job = this.jobs.get(jobId);
    return job ? structuredClone(job) : undefined;
  }

  public list(): readonly FleetJob[] {
    return [...this.jobs.values()].map((job) => structuredClone(job));
  }
}

export interface FleetControlPlaneDependencies {
  readonly registry: RegistryReader;
  readonly leases: DeviceLeaseStore;
  readonly evidence: EvidenceSink;
  readonly backend: DeviceBackend;
  readonly policy: PolicyEvaluator;
  readonly jobs?: InMemoryFleetJobStore;
  readonly clock?: Clock;
}

export class FleetControlPlane {
  public readonly jobs: InMemoryFleetJobStore;
  private readonly clock: Clock;

  public constructor(private readonly dependencies: FleetControlPlaneDependencies) {
    this.jobs = dependencies.jobs ?? new InMemoryFleetJobStore();
    this.clock = dependencies.clock ?? new SystemClock();
  }

  public async status(): Promise<{
    readonly service: "iphone-fleet-agent";
    readonly devices: number;
    readonly jobs: Record<FleetJobState, number>;
  }> {
    const counts: Record<FleetJobState, number> = {
      QUEUED: 0,
      RUNNING: 0,
      NEEDS_HUMAN: 0,
      SUCCEEDED: 0,
      FAILED: 0,
    };
    for (const job of this.jobs.list()) counts[job.state] += 1;
    return {
      service: "iphone-fleet-agent",
      devices: (await this.dependencies.registry.listDevices()).length,
      jobs: counts,
    };
  }

  public listDevices() {
    return this.dependencies.registry.listDevices();
  }

  public findDevice(input: {
    readonly clientId: string;
    readonly accountId: string;
    readonly networkAssignmentId: string;
  }) {
    return this.dependencies.registry.findDevice(input);
  }

  public getJob(jobId: JobId): FleetJob | undefined {
    return this.jobs.get(jobId);
  }

  public getEvidence(jobId: JobId): Promise<readonly EvidenceRecord[]> {
    return this.dependencies.evidence.listByJob(jobId);
  }

  public async submit(input: SubmitFleetJob): Promise<FleetJob> {
    if (this.jobs.get(input.jobId)) {
      throw new FleetError("CONTEXT_MISMATCH", `Job ${input.jobId} already exists`);
    }
    const submittedAt = this.clock.now().toISOString();
    this.jobs.set({
      jobId: input.jobId,
      state: "QUEUED",
      submittedAt,
      updatedAt: submittedAt,
      input,
    });

    const device = await this.dependencies.registry.getDevice(input.deviceId);
    const account = await this.dependencies.registry.getAccount(input.accountId);
    const network = await this.dependencies.registry.getNetworkAssignment(
      input.networkAssignmentId,
    );
    if (!device || !account || !network) {
      const failed = this.updateJob(input, "FAILED", undefined, {
        code: "CONTEXT_MISMATCH",
        message: "Device, account or network assignment was not found",
      });
      return failed;
    }

    let context: ExecutionContext | undefined;
    let primaryFailure: unknown;
    let terminalJob: FleetJob | undefined;
    try {
      const lease = await this.dependencies.leases.acquire({
        jobId: input.jobId,
        clientId: input.clientId,
        accountId: input.accountId,
        deviceId: input.deviceId,
        networkAssignmentId: input.networkAssignmentId,
        actorId: input.actorId,
        correlationId: input.correlationId,
        ttlMs: input.leaseTtlMs ?? 60_000,
      });
      context = {
        jobId: lease.jobId,
        clientId: lease.clientId,
        accountId: lease.accountId,
        deviceId: lease.deviceId,
        networkAssignmentId: lease.networkAssignmentId,
        leaseId: lease.leaseId,
        fencingToken: lease.fencingToken,
        actorId: lease.actorId,
        correlationId: lease.correlationId,
      };
      this.updateJob(input, "RUNNING", context);

      await authorizeDeviceAction({
        context,
        action: input.action,
        device,
        account,
        network,
        leaseStore: this.dependencies.leases,
        policy: this.dependencies.policy,
      });

      const health = await this.dependencies.backend.health(context.deviceId);
      if (!health.online) throw new FleetError("DEVICE_OFFLINE", "Device backend reports offline");
      const activeContext = context;

      const actionResult = await withFleetSpan(
        "fleet.device.action",
        activeContext,
        { "fleet.action.name": input.action.name },
        () => this.dependencies.backend.execute(activeContext, input.action),
      );
      if (actionResult.outcome !== "SUCCEEDED") {
        throw new FleetError("VERIFICATION_FAILED", actionResult.message ?? "Device action failed");
      }

      const verification = await withFleetSpan(
        "fleet.device.verify",
        activeContext,
        { "fleet.verification.name": input.verification.name },
        () => this.dependencies.backend.verify(activeContext, input.verification),
      );
      if (!verification.verified) {
        throw new FleetError(
          "VERIFICATION_FAILED",
          verification.message ?? "Postcondition failed",
          {
            observed: verification.observed,
          },
        );
      }

      await this.appendEvidence(context, input, "verify", "SUCCEEDED", {
        actionResult,
        verification,
      });
      terminalJob = this.updateJob(input, "SUCCEEDED", context);
    } catch (error) {
      primaryFailure = error;
      const normalized = this.normalizeError(error);
      terminalJob = this.updateJob(input, "FAILED", context, normalized);
      if (context) {
        await this.appendEvidence(context, input, "failed", "FAILED", normalized);
      }
    } finally {
      if (context) {
        try {
          await this.dependencies.leases.release(context);
        } catch (releaseError) {
          if (!primaryFailure) {
            const normalized = this.normalizeError(releaseError);
            await this.appendEvidence(context, input, "release", "FAILED", normalized);
            terminalJob = this.updateJob(input, "FAILED", context, normalized);
          }
        }
      }
    }
    if (!terminalJob) {
      throw new FleetError("CONTEXT_MISMATCH", "Job did not reach a terminal state");
    }
    return terminalJob;
  }

  public async requestHuman(jobId: JobId, reason: string): Promise<FleetJob> {
    const job = this.jobs.get(jobId);
    if (!job?.context) throw new FleetError("JOB_NOT_FOUND", `Runnable job ${jobId} was not found`);
    await this.appendEvidence(job.context, job.input, "human-gate", "NEEDS_HUMAN", { reason });
    return this.updateJob(job.input, "NEEDS_HUMAN", job.context);
  }

  private updateJob(
    input: SubmitFleetJob,
    state: FleetJobState,
    context?: ExecutionContext,
    error?: { readonly code: string; readonly message: string },
  ): FleetJob {
    const current = this.jobs.get(input.jobId);
    const job: FleetJob = {
      jobId: input.jobId,
      state,
      submittedAt: current?.submittedAt ?? this.clock.now().toISOString(),
      updatedAt: this.clock.now().toISOString(),
      input,
      ...(context ? { context } : {}),
      ...(error ? { error } : {}),
    };
    this.jobs.set(job);
    return job;
  }

  private async appendEvidence(
    context: ExecutionContext,
    input: SubmitFleetJob,
    step: string,
    outcome: EvidenceRecord["outcome"],
    details: Readonly<Record<string, unknown>>,
  ): Promise<void> {
    await withFleetSpan(
      "fleet.evidence.append",
      context,
      { "fleet.evidence.step": step, "fleet.evidence.outcome": outcome },
      () =>
        this.dependencies.evidence.append({
          evidenceId: `EVIDENCE-${randomUUID()}`,
          context,
          workflowRevision: input.workflowRevision,
          step,
          timestamp: this.clock.now().toISOString(),
          outcome,
          details,
        }),
    );
  }

  private normalizeError(error: unknown): { code: string; message: string } {
    return error instanceof FleetError
      ? { code: error.code, message: error.message }
      : {
          code: "UNEXPECTED_ERROR",
          message: error instanceof Error ? error.message : String(error),
        };
  }
}
