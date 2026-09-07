import {
  ConcurrencyLimitStrategy,
  type Context,
  type DurableContext,
  type HatchetClient,
  type Worker,
} from "@hatchet-dev/typescript-sdk/v1/index.js";
import { type ExecutionContext, parseExecutionContext } from "@iphone-fleet/contracts";

export const FLEET_WORKFLOW_REVISION = "fleet-job-v0.1";
export const HUMAN_RESUME_EVENT = "fleet:human-resume";

export type FleetWorkflowInput = {
  context: ExecutionContext;
  deviceConcurrency: number;
  actionDurationMs: number;
  failFirstActionAttempt: boolean;
};

export type HumanWaitInput = {
  context: ExecutionContext;
};

export type ActionInterval = {
  jobId: string;
  deviceId: string;
  attempt: number;
  startedAt: number;
  finishedAt: number;
};

export class WorkflowProbe {
  readonly actionIntervals: ActionInterval[] = [];
  readonly humanWaitStarted = new Set<string>();
  readonly maximumActiveByDevice = new Map<string, number>();
  maximumActiveAcrossDevices = 0;
  private readonly waiters = new Map<string, () => void>();
  private readonly activeByDevice = new Map<string, number>();
  private activeAcrossDevices = 0;

  markActionStarted(deviceId: string): void {
    const activeForDevice = (this.activeByDevice.get(deviceId) ?? 0) + 1;
    this.activeByDevice.set(deviceId, activeForDevice);
    this.maximumActiveByDevice.set(
      deviceId,
      Math.max(this.maximumActiveByDevice.get(deviceId) ?? 0, activeForDevice),
    );
    this.activeAcrossDevices += 1;
    this.maximumActiveAcrossDevices = Math.max(
      this.maximumActiveAcrossDevices,
      this.activeAcrossDevices,
    );
  }

  markActionFinished(deviceId: string): void {
    this.activeByDevice.set(deviceId, Math.max(0, (this.activeByDevice.get(deviceId) ?? 1) - 1));
    this.activeAcrossDevices = Math.max(0, this.activeAcrossDevices - 1);
  }

  markHumanWaitStarted(jobId: string): void {
    this.humanWaitStarted.add(jobId);
    this.waiters.get(jobId)?.();
    this.waiters.delete(jobId);
  }

  waitForHumanWaitStart(jobId: string): Promise<void> {
    if (this.humanWaitStarted.has(jobId)) {
      return Promise.resolve();
    }
    return new Promise((resolve) => this.waiters.set(jobId, resolve));
  }
}

function requireValidContext(context: ExecutionContext): ExecutionContext {
  return parseExecutionContext(context);
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function createFleetWorkflows(client: HatchetClient, probe: WorkflowProbe) {
  const fleetJob = client.workflow<FleetWorkflowInput>({
    name: "fleet-job-a4",
    version: FLEET_WORKFLOW_REVISION,
    concurrency: {
      expression: "input.context.deviceId",
      maxRuns: "input.deviceConcurrency",
      limitStrategy: ConcurrencyLimitStrategy.GROUP_ROUND_ROBIN,
    },
  });

  const reserve = fleetJob.task({
    name: "reserve",
    desiredWorkerLabels: { runtime: { value: "wsl", required: true } },
    fn: (input: FleetWorkflowInput) => {
      const context = requireValidContext(input.context);
      if (input.deviceConcurrency !== 1) {
        throw new Error("A4 device concurrency must be exactly one");
      }
      return {
        jobId: context.jobId,
        deviceId: context.deviceId,
        leaseId: context.leaseId,
        fencingToken: context.fencingToken,
      };
    },
  });

  const deviceAction = fleetJob.task({
    name: "device-action",
    parents: [reserve],
    retries: 2,
    desiredWorkerLabels: { runtime: { value: "wsl", required: true } },
    fn: async (input: FleetWorkflowInput, ctx: Context<FleetWorkflowInput>) => {
      requireValidContext(input.context);
      const attempt = ctx.retryCount();
      const interval: ActionInterval = {
        jobId: input.context.jobId,
        deviceId: input.context.deviceId,
        attempt,
        startedAt: Date.now(),
        finishedAt: 0,
      };
      probe.actionIntervals.push(interval);
      probe.markActionStarted(input.context.deviceId);
      try {
        if (input.failFirstActionAttempt && attempt === 0) {
          throw new Error("injected transient action failure");
        }
        await sleep(input.actionDurationMs);
        return { action: "mock-tap", outcome: "executed" };
      } finally {
        interval.finishedAt = Date.now();
        probe.markActionFinished(input.context.deviceId);
      }
    },
  });

  const verify = fleetJob.task({
    name: "verify",
    parents: [deviceAction],
    desiredWorkerLabels: { runtime: { value: "wsl", required: true } },
    fn: async (input: FleetWorkflowInput, ctx: Context<FleetWorkflowInput>) => {
      requireValidContext(input.context);
      const action = await ctx.parentOutput(deviceAction);
      if (action.outcome !== "executed") {
        throw new Error("device action did not complete");
      }
      return { verified: true };
    },
  });

  const evidence = fleetJob.task({
    name: "evidence",
    parents: [verify],
    desiredWorkerLabels: { runtime: { value: "wsl", required: true } },
    fn: async (input: FleetWorkflowInput, ctx: Context<FleetWorkflowInput>) => {
      const context = requireValidContext(input.context);
      const verification = await ctx.parentOutput(verify);
      if (!verification.verified) {
        throw new Error("verified evidence is required");
      }
      return {
        jobId: context.jobId,
        clientId: context.clientId,
        accountId: context.accountId,
        deviceId: context.deviceId,
        networkAssignmentId: context.networkAssignmentId,
        leaseId: context.leaseId,
        fencingToken: context.fencingToken,
        actorId: context.actorId,
        correlationId: context.correlationId,
        workflowRevision: FLEET_WORKFLOW_REVISION,
        outcome: "verified",
      };
    },
  });

  fleetJob.task({
    name: "success",
    parents: [evidence],
    desiredWorkerLabels: { runtime: { value: "wsl", required: true } },
    fn: async (_input: FleetWorkflowInput, ctx: Context<FleetWorkflowInput>) => {
      const recorded = await ctx.parentOutput(evidence);
      if (recorded.outcome !== "verified") {
        throw new Error("workflow cannot succeed without evidence");
      }
      return { terminalState: "SUCCEEDED", evidence: recorded };
    },
  });

  const humanWait = client.durableTask({
    name: "fleet-needs-human-a4",
    executionTimeout: "5m",
    fn: async (input: HumanWaitInput, ctx: DurableContext<HumanWaitInput>) => {
      const context = requireValidContext(input.context);
      probe.markHumanWaitStarted(context.jobId);
      const event = await ctx.waitForEvent(HUMAN_RESUME_EVENT, "true", undefined, context.jobId);
      return {
        terminalState: "RESUMED",
        jobId: context.jobId,
        deviceId: context.deviceId,
        event,
      };
    },
  });

  return { fleetJob, humanWait };
}

export async function createFleetWorker(
  client: HatchetClient,
  workflows: ReturnType<typeof createFleetWorkflows>,
  workerName: string,
): Promise<Worker> {
  return client.worker(workerName, {
    workflows: [workflows.fleetJob, workflows.humanWait],
    slots: 4,
    durableSlots: 4,
    labels: { runtime: "wsl", role: "fleet-device-worker" },
  });
}
