import { HatchetEmbeddedClient } from "@hatchet-dev/typescript-sdk/v1/embedded.js";
import type { WorkflowRun } from "@iphone-fleet/application";
import type { ExecutionContext } from "@iphone-fleet/contracts";
import { FleetControlPlane } from "@iphone-fleet/control-plane";
import type { PolicyEvaluator } from "@iphone-fleet/domain";
import {
  InMemoryDeviceLeaseStore,
  InMemoryEvidenceSink,
  InMemoryRegistry,
  MockDeviceBackend,
  SystemClock,
} from "@iphone-fleet/inmemory";
import {
  MobileAgentPhoneOperator,
  RecordedMobileAgentRuntime,
} from "@iphone-fleet/mobile-agent-operator";
import { FleetDeviceAdapter } from "@iphone-fleet/phone-operator";
import {
  createFleetWorker,
  createFleetWorkflows,
  HUMAN_RESUME_EVENT,
  WorkflowProbe,
} from "./fleet-workflow.js";
import {
  createPhoneOperatorWorker,
  createPhoneOperatorWorkflow,
  HatchetPhoneOperatorWorkflowEngine,
} from "./phone-operator-workflow.js";

const EMBEDDED_VERSION = "v0.105.16";
const LINUX_AMD64_CHECKSUM = "68967396279f859c33897ed6228f2fa47874814a56de537fad4f4a31370921a6";

function context(jobId: string, deviceId: string): ExecutionContext {
  return {
    jobId,
    clientId: "CLIENT-A4",
    accountId: "ACCOUNT-A4",
    deviceId,
    networkAssignmentId: "NETWORK-A4",
    leaseId: `LEASE-${jobId}`,
    fencingToken: 41,
    actorId: "A4-INTEGRATION",
    correlationId: `CORR-${jobId}`,
  };
}

async function withTimeout<T>(
  promise: Promise<T>,
  milliseconds: number,
  label: string,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out`)), milliseconds);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function maximumOverlap(intervals: Array<{ startedAt: number; finishedAt: number }>): number {
  const events = intervals.flatMap((item) => [
    { at: item.startedAt, delta: 1 },
    { at: item.finishedAt, delta: -1 },
  ]);
  events.sort((left, right) => left.at - right.at || left.delta - right.delta);
  let active = 0;
  let maximum = 0;
  for (const event of events) {
    active += event.delta;
    maximum = Math.max(maximum, active);
  }
  return maximum;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  const postgresDataDir = process.env.HATCHET_EMBEDDED_DATA_DIR;
  assert(postgresDataDir, "HATCHET_EMBEDDED_DATA_DIR is required");

  const client = await HatchetEmbeddedClient.init({
    version: EMBEDDED_VERSION,
    checksum: LINUX_AMD64_CHECKSUM,
    postgresDataDir,
    logLevel: "warn",
    readyTimeoutMs: 300_000,
  });
  const probe = new WorkflowProbe();
  const workflows = createFleetWorkflows(client, probe);
  let worker = await createFleetWorker(client, workflows, "fleet-a4-worker-1");
  const ma1Clock = new SystemClock();
  const ma1Registry = new InMemoryRegistry({
    devices: [
      {
        id: "DEVICE-MA1-VERTICAL",
        clientId: "CLIENT-MA1",
        accountId: "ACCOUNT-MA1",
        networkAssignmentId: "NETWORK-MA1",
        state: "READY",
      },
    ],
    accounts: [
      {
        id: "ACCOUNT-MA1",
        clientId: "CLIENT-MA1",
        assignedDeviceId: "DEVICE-MA1-VERTICAL",
        networkAssignmentId: "NETWORK-MA1",
        state: "READY",
      },
    ],
    networkAssignments: [
      {
        id: "NETWORK-MA1",
        clientId: "CLIENT-MA1",
        accountId: "ACCOUNT-MA1",
        deviceId: "DEVICE-MA1-VERTICAL",
        state: "READY",
      },
    ],
  });
  const ma1Leases = new InMemoryDeviceLeaseStore(ma1Clock);
  const ma1Evidence = new InMemoryEvidenceSink();
  const ma1Backend = new MockDeviceBackend(ma1Clock);
  ma1Backend.configure("DEVICE-MA1-VERTICAL", {
    online: true,
    initialState: { foregroundApp: "SpringBoard" },
  });
  const ma1Policy: PolicyEvaluator = {
    async evaluate(_context, action) {
      return ["phone_operator_task", "open_app"].includes(action.name)
        ? { outcome: "ALLOW", reason: "MA1 embedded integration allow-list" }
        : { outcome: "DENY", reason: "MA1 embedded integration deny" };
    },
  };
  const operatorExecutions = new Map<string, number>();
  const operatorDeclaration = createPhoneOperatorWorkflow(client, {
    async execute(submission) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      const count = (operatorExecutions.get(submission.context.jobId) ?? 0) + 1;
      operatorExecutions.set(submission.context.jobId, count);
      if (submission.context.jobId === "JOB-MA1-HUMAN" && count === 1) {
        return { jobId: submission.context.jobId, state: "NEEDS_HUMAN" };
      }
      if (submission.context.jobId === "JOB-MA1-VERTICAL") {
        const device = new FleetDeviceAdapter({
          context: submission.context,
          registry: ma1Registry,
          leases: ma1Leases,
          policy: ma1Policy,
          backend: ma1Backend,
          evidence: ma1Evidence,
          audit: {
            operator: "mobile-agent-v3.5",
            upstreamSha: "11cea575561fb7800b5fb6b6cafa56f7a91de11f",
            model: "RECORDED_MODEL_FIXTURE",
            workflowRevision: submission.workflowRevision,
          },
        });
        const operator = new MobileAgentPhoneOperator({
          runtime: new RecordedMobileAgentRuntime({
            proposals: [
              { action: "open", text: "Settings", decisionSummary: "Open Settings" },
              { action: "terminate", status: "success", decisionSummary: "Done" },
            ],
          }),
          device,
          model: "RECORDED_MODEL_FIXTURE",
        });
        const result = await operator.run({
          executionContext: submission.context,
          instruction: "Open Settings",
          limits: { maxSteps: 5, timeoutMs: 10_000, maxConsecutiveFailures: 2 },
          policyProfile: "ma1-safe-read-only",
          verification: submission.verification,
          workflowRevision: submission.workflowRevision,
          metadata: {},
        });
        return {
          jobId: submission.context.jobId,
          state:
            result.status === "SUCCEEDED"
              ? "SUCCEEDED"
              : result.status === "HUMAN_REQUIRED"
                ? "NEEDS_HUMAN"
                : "FAILED",
        };
      }
      return { jobId: submission.context.jobId, state: "SUCCEEDED" };
    },
  });
  let operatorWorker = await createPhoneOperatorWorker(
    client,
    operatorDeclaration,
    "fleet-ma1-operator-worker",
  );

  try {
    void worker.start();
    void operatorWorker.start();
    await worker.waitUntilReady(30_000);
    await operatorWorker.waitUntilReady(30_000);
    assert(worker.config.slots === 4, "worker slots were not configured");
    assert(worker.config.durableSlots === 4, "durable worker slots were not configured");
    assert(worker.getLabels().runtime === "wsl", "worker label was not registered");

    const operatorEngine = new HatchetPhoneOperatorWorkflowEngine(client, operatorDeclaration);
    const ma1ControlPlane = new FleetControlPlane({
      registry: ma1Registry,
      leases: ma1Leases,
      evidence: ma1Evidence,
      backend: ma1Backend,
      policy: ma1Policy,
      workflowEngine: operatorEngine,
      clock: ma1Clock,
    });
    const verticalJob = await ma1ControlPlane.submit({
      jobId: "JOB-MA1-VERTICAL",
      clientId: "CLIENT-MA1",
      accountId: "ACCOUNT-MA1",
      deviceId: "DEVICE-MA1-VERTICAL",
      networkAssignmentId: "NETWORK-MA1",
      actorId: "MA1-HATCHET-E2E",
      correlationId: "CORR-MA1-VERTICAL",
      action: { name: "phone_operator_task", parameters: { instruction: "Open Settings" } },
      verification: { name: "state_contains", expected: { foregroundApp: "Settings" } },
      workflowRevision: "ma1-hatchet-v1",
    });
    assert(verticalJob.state === "SUCCEEDED", "MA1 full Hatchet vertical slice failed");
    assert(
      ma1Backend.calls.some((call) => call.action.name === "open_app"),
      "MA1 full Hatchet vertical slice did not reach DeviceBackend",
    );
    const operatorContexts = [
      context("JOB-MA1-HATCHET-1", "DEVICE-MA1-A"),
      context("JOB-MA1-HATCHET-2", "DEVICE-MA1-A"),
      context("JOB-MA1-HATCHET-3", "DEVICE-MA1-B"),
    ];
    const operatorRuns = await withTimeout(
      Promise.all(
        operatorContexts.map((operatorContext) =>
          operatorEngine.submit({
            context: operatorContext,
            action: { name: "phone_operator_task", parameters: { instruction: "recorded" } },
            verification: { name: "state_contains", expected: {} },
            workflowRevision: "ma1-hatchet-v1",
          }),
        ),
      ),
      60_000,
      "phone operator workflows",
    );
    assert(
      operatorRuns.every((run: WorkflowRun) => run.state === "SUCCEEDED"),
      "PhoneOperator Hatchet workflow failed",
    );

    const operatorHumanContext = context("JOB-MA1-HUMAN", "DEVICE-MA1-C");
    const operatorHumanRun = operatorEngine.submit({
      context: operatorHumanContext,
      action: { name: "phone_operator_task", parameters: { instruction: "resume safely" } },
      verification: { name: "state_contains", expected: {} },
      workflowRevision: "ma1-hatchet-v1",
    });
    await withTimeout(
      operatorDeclaration.probe.waitForHumanWaitStart(operatorHumanContext.jobId),
      30_000,
      "PhoneOperator durable wait start",
    );
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    await operatorWorker.stop();
    operatorWorker = await createPhoneOperatorWorker(
      client,
      operatorDeclaration,
      "fleet-ma1-operator-worker-2",
    );
    void operatorWorker.start();
    await operatorWorker.waitUntilReady(30_000);
    await operatorEngine.signalHumanResolved(operatorHumanContext.jobId, "A4-HUMAN");
    const resumedOperatorRun = await withTimeout(
      operatorHumanRun,
      60_000,
      "PhoneOperator durable resume",
    );
    assert(
      resumedOperatorRun.state === "SUCCEEDED",
      "PhoneOperator did not re-observe and succeed after human resume",
    );

    const inputs = [
      {
        context: context("JOB-A4-1", "DEVICE-A4-A"),
        deviceConcurrency: 1,
        actionDurationMs: 1_500,
        failFirstActionAttempt: false,
      },
      {
        context: context("JOB-A4-2", "DEVICE-A4-A"),
        deviceConcurrency: 1,
        actionDurationMs: 1_500,
        failFirstActionAttempt: false,
      },
      {
        context: context("JOB-A4-RETRY", "DEVICE-A4-D"),
        deviceConcurrency: 1,
        actionDurationMs: 1_500,
        failFirstActionAttempt: true,
      },
      {
        context: context("JOB-A4-3", "DEVICE-A4-B"),
        deviceConcurrency: 1,
        actionDurationMs: 1_500,
        failFirstActionAttempt: false,
      },
    ];
    const refs = await Promise.all(
      inputs.map((input) => client.runNoWait(workflows.fleetJob, input)),
    );
    const outputs = await withTimeout(
      Promise.all(refs.map((ref) => ref.output)),
      90_000,
      "fleet workflows",
    );
    for (const output of outputs) {
      const serialized = JSON.stringify(output);
      assert(serialized.includes("SUCCEEDED"), "workflow did not reach its terminal state");
      assert(serialized.includes("verified"), "workflow succeeded without verified evidence");
    }

    assert(probe.maximumActiveByDevice.get("DEVICE-A4-A") === 1, "same device ran concurrently");
    assert(probe.maximumActiveAcrossDevices >= 2, "different devices did not run in parallel");
    const retried = probe.actionIntervals.filter((item) => item.jobId === "JOB-A4-RETRY");
    assert(
      retried.some((item) => item.attempt === 0),
      "initial retry attempt was not observed",
    );
    assert(
      retried.some((item) => item.attempt === 1),
      "Hatchet retry was not observed",
    );

    const humanContext = context("JOB-A4-HUMAN", "DEVICE-A4-C");
    const humanRef = await client.runNoWait(workflows.humanWait, { context: humanContext });
    await withTimeout(
      probe.waitForHumanWaitStart(humanContext.jobId),
      30_000,
      "durable wait start",
    );
    // The task function is entered before the engine acknowledges and persists the wait.
    // Allow that protocol handshake to finish before simulating worker loss.
    await new Promise((resolve) => setTimeout(resolve, 2_000));

    await worker.stop();
    worker = await createFleetWorker(client, workflows, "fleet-a4-worker-2");
    void worker.start();
    await worker.waitUntilReady(30_000);
    await client.events.push(
      HUMAN_RESUME_EVENT,
      { approved: true, actorId: humanContext.actorId },
      { scope: humanContext.jobId },
    );
    const humanOutput = await withTimeout(humanRef.output, 60_000, "durable resume");
    assert(
      typeof humanOutput === "object" && humanOutput !== null,
      "durable resume did not return output",
    );

    process.stdout.write(
      `${JSON.stringify(
        {
          gate: "A4",
          embeddedVersion: EMBEDDED_VERSION,
          sdkVersion: "1.31.0",
          workerLabels: worker.getLabels(),
          workerSlots: worker.config.slots,
          sameDeviceMaximumConcurrency: probe.maximumActiveByDevice.get("DEVICE-A4-A"),
          allDevicesMaximumConcurrency: probe.maximumActiveAcrossDevices,
          retryAttempts: retried.map((item) => item.attempt),
          durableWait: "resumed-after-worker-restart",
          phoneOperatorWorkflow: "SUCCEEDED",
          phoneOperatorFullMockVerticalSlice: verticalJob.state,
          phoneOperatorDurableWait: "resumed-after-worker-restart",
          phoneOperatorSameDeviceMaximumConcurrency: maximumOverlap(
            operatorDeclaration.probe.intervals.filter((item) => item.deviceId === "DEVICE-MA1-A"),
          ),
          phoneOperatorAllDevicesMaximumConcurrency: maximumOverlap(
            operatorDeclaration.probe.intervals,
          ),
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await operatorWorker.stop().catch(() => undefined);
    await worker.stop().catch(() => undefined);
    await client.stopEmbedded();
  }
}

await main();
process.exit(0);
