import { HatchetEmbeddedClient } from "@hatchet-dev/typescript-sdk/v1/embedded.js";
import type { ExecutionContext } from "@iphone-fleet/contracts";
import {
  createFleetWorker,
  createFleetWorkflows,
  HUMAN_RESUME_EVENT,
  WorkflowProbe,
} from "./fleet-workflow.js";

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

  try {
    void worker.start();
    await worker.waitUntilReady(30_000);
    assert(worker.config.slots === 4, "worker slots were not configured");
    assert(worker.config.durableSlots === 4, "durable worker slots were not configured");
    assert(worker.getLabels().runtime === "wsl", "worker label was not registered");

    const inputs = [
      {
        context: context("JOB-A4-1", "DEVICE-A4-A"),
        deviceConcurrency: 1,
        actionDurationMs: 400,
        failFirstActionAttempt: true,
      },
      {
        context: context("JOB-A4-2", "DEVICE-A4-A"),
        deviceConcurrency: 1,
        actionDurationMs: 400,
        failFirstActionAttempt: false,
      },
      {
        context: context("JOB-A4-3", "DEVICE-A4-B"),
        deviceConcurrency: 1,
        actionDurationMs: 400,
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

    const successfulIntervals = probe.actionIntervals.filter(
      (item) => item.finishedAt > item.startedAt,
    );
    const deviceA = successfulIntervals.filter((item) => item.deviceId === "DEVICE-A4-A");
    assert(maximumOverlap(deviceA) === 1, "same device ran concurrently");
    assert(maximumOverlap(successfulIntervals) >= 2, "different devices did not run in parallel");
    const retried = probe.actionIntervals.filter((item) => item.jobId === "JOB-A4-1");
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
          sameDeviceMaximumConcurrency: maximumOverlap(deviceA),
          allDevicesMaximumConcurrency: maximumOverlap(successfulIntervals),
          retryAttempts: retried.map((item) => item.attempt),
          durableWait: "resumed-after-worker-restart",
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await worker.stop().catch(() => undefined);
    await client.stopEmbedded();
  }
}

await main();
process.exit(0);
