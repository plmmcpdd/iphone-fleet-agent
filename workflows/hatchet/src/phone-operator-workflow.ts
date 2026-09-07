import {
  ConcurrencyLimitStrategy,
  type Context,
  type DurableContext,
  type HatchetClient,
  type Worker,
} from "@hatchet-dev/typescript-sdk/v1/index.js";
import type { WorkflowEngine, WorkflowRun, WorkflowSubmission } from "@iphone-fleet/application";
import {
  DeviceActionSchema,
  DeviceVerificationSchema,
  type JobId,
  parseExecutionContext,
} from "@iphone-fleet/contracts";

export const PHONE_OPERATOR_WORKFLOW_REVISION = "phone-operator-ma1-v1";

export type PhoneOperatorWorkflowInput = {
  readonly context: WorkflowSubmission["context"];
  readonly actionJson: string;
  readonly verificationJson: string;
  readonly workflowRevision: string;
  readonly deviceConcurrency: 1;
};

export interface PhoneOperatorWorkflowHandler {
  execute(submission: WorkflowSubmission, attempt: number): Promise<WorkflowRun>;
}

export interface PhoneOperatorInterval {
  readonly jobId: string;
  readonly deviceId: string;
  readonly attempt: number;
  readonly startedAt: number;
  finishedAt: number;
}

export class PhoneOperatorWorkflowProbe {
  public readonly intervals: PhoneOperatorInterval[] = [];
  public readonly humanWaitStarted = new Set<string>();
  private readonly humanWaiters = new Map<string, () => void>();

  public markHumanWaitStarted(jobId: string): void {
    this.humanWaitStarted.add(jobId);
    this.humanWaiters.get(jobId)?.();
    this.humanWaiters.delete(jobId);
  }

  public waitForHumanWaitStart(jobId: string): Promise<void> {
    if (this.humanWaitStarted.has(jobId)) return Promise.resolve();
    return new Promise((resolve) => this.humanWaiters.set(jobId, resolve));
  }
}

export function createPhoneOperatorWorkflow(
  client: HatchetClient,
  handler: PhoneOperatorWorkflowHandler,
  probe = new PhoneOperatorWorkflowProbe(),
) {
  const workflow = client.workflow<PhoneOperatorWorkflowInput>({
    name: "fleet-phone-operator-ma1",
    version: PHONE_OPERATOR_WORKFLOW_REVISION,
    concurrency: {
      expression: "input.context.deviceId",
      maxRuns: 1,
      limitStrategy: ConcurrencyLimitStrategy.GROUP_ROUND_ROBIN,
    },
  });
  workflow.task({
    name: "run-phone-operator",
    retries: 2,
    desiredWorkerLabels: { runtime: { value: "wsl", required: true } },
    fn: async (input: PhoneOperatorWorkflowInput, ctx: Context<PhoneOperatorWorkflowInput>) => {
      const context = parseExecutionContext(input.context);
      if (input.deviceConcurrency !== 1)
        throw new Error("PhoneOperator device concurrency must be one");
      const submission: WorkflowSubmission = {
        context,
        action: DeviceActionSchema.parse(JSON.parse(input.actionJson)),
        verification: DeviceVerificationSchema.parse(JSON.parse(input.verificationJson)),
        workflowRevision: input.workflowRevision,
      };
      const interval: PhoneOperatorInterval = {
        jobId: context.jobId,
        deviceId: context.deviceId,
        attempt: ctx.retryCount(),
        startedAt: Date.now(),
        finishedAt: 0,
      };
      probe.intervals.push(interval);
      try {
        return await handler.execute(submission, interval.attempt);
      } finally {
        interval.finishedAt = Date.now();
      }
    },
  });
  const humanWait = client.durableTask({
    name: "fleet-phone-operator-human-wait-ma1",
    executionTimeout: "5m",
    fn: async (
      input: { context: WorkflowSubmission["context"] },
      ctx: DurableContext<{ context: WorkflowSubmission["context"] }>,
    ) => {
      const context = parseExecutionContext(input.context);
      probe.markHumanWaitStarted(context.jobId);
      await ctx.waitForEvent("fleet:human-resume", "true", undefined, context.jobId);
      return { jobId: context.jobId, state: "RESUMED" };
    },
  });
  return { workflow, humanWait, probe };
}

export async function createPhoneOperatorWorker(
  client: HatchetClient,
  declaration: ReturnType<typeof createPhoneOperatorWorkflow>,
  workerName: string,
): Promise<Worker> {
  return client.worker(workerName, {
    workflows: [declaration.workflow, declaration.humanWait],
    slots: 4,
    durableSlots: 4,
    labels: { runtime: "wsl", role: "fleet-phone-operator-worker" },
  });
}

export class HatchetPhoneOperatorWorkflowEngine implements WorkflowEngine {
  private readonly runs = new Map<JobId, WorkflowRun>();

  public constructor(
    private readonly client: HatchetClient,
    private readonly declaration: ReturnType<typeof createPhoneOperatorWorkflow>,
  ) {}

  public async submit(input: WorkflowSubmission): Promise<WorkflowRun> {
    this.runs.set(input.context.jobId, { jobId: input.context.jobId, state: "QUEUED" });
    try {
      for (;;) {
        const ref = await this.client.runNoWait(this.declaration.workflow, {
          context: input.context,
          actionJson: JSON.stringify(input.action),
          verificationJson: JSON.stringify(input.verification),
          workflowRevision: input.workflowRevision,
          deviceConcurrency: 1,
        });
        this.runs.set(input.context.jobId, { jobId: input.context.jobId, state: "RUNNING" });
        const output = await ref.output;
        const run = findWorkflowRun(output, input.context.jobId) ?? {
          jobId: input.context.jobId,
          state: "FAILED" as const,
        };
        this.runs.set(input.context.jobId, run);
        if (run.state !== "NEEDS_HUMAN") return run;
        const waitRef = await this.client.runNoWait(this.declaration.humanWait, {
          context: input.context,
        });
        await waitRef.output;
      }
    } catch {
      const failed = { jobId: input.context.jobId, state: "FAILED" as const };
      this.runs.set(input.context.jobId, failed);
      return failed;
    }
  }

  public async get(jobId: JobId): Promise<WorkflowRun | undefined> {
    return this.runs.get(jobId);
  }

  public async signalHumanResolved(jobId: JobId, actorId: string): Promise<void> {
    await this.client.events.push("fleet:human-resume", { actorId }, { scope: jobId });
  }
}

function findWorkflowRun(value: unknown, jobId: JobId): WorkflowRun | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const candidate = value as Record<string, unknown>;
  if (
    candidate.jobId === jobId &&
    ["QUEUED", "RUNNING", "NEEDS_HUMAN", "SUCCEEDED", "FAILED"].includes(String(candidate.state))
  ) {
    return { jobId, state: candidate.state as WorkflowRun["state"] };
  }
  for (const nested of Object.values(candidate)) {
    const found = findWorkflowRun(nested, jobId);
    if (found) return found;
  }
  return undefined;
}
