import type { PhoneOperatorTask } from "@iphone-fleet/application";
import type { ExecutionContext } from "@iphone-fleet/contracts";
import type { PolicyEvaluator } from "@iphone-fleet/domain";
import {
  InMemoryDeviceLeaseStore,
  InMemoryEvidenceSink,
  InMemoryRegistry,
  MockDeviceBackend,
  MutableClock,
} from "@iphone-fleet/inmemory";
import { FleetDeviceAdapter } from "@iphone-fleet/phone-operator";
import {
  MobileAgentPhoneOperator,
  RecordedMobileAgentRuntime,
  type RecordedRuntimeOptions,
} from "../src/index.js";

export async function createOperatorHarness(options: {
  readonly policy?: PolicyEvaluator;
  readonly device?: {
    online?: boolean;
    failExecution?: boolean;
    failVerification?: boolean;
    failObservation?: boolean;
  };
  readonly runtime: RecordedRuntimeOptions;
}): Promise<ReturnType<typeof assemble>> {
  const clock = new MutableClock(new Date("2026-09-07T00:00:00.000Z"));
  const registry = new InMemoryRegistry({
    devices: [
      {
        id: "DEVICE-001",
        clientId: "CLIENT-001",
        accountId: "ACCOUNT-001",
        networkAssignmentId: "NETWORK-001",
        state: "READY",
      },
    ],
    accounts: [
      {
        id: "ACCOUNT-001",
        clientId: "CLIENT-001",
        assignedDeviceId: "DEVICE-001",
        networkAssignmentId: "NETWORK-001",
        state: "READY",
      },
    ],
    networkAssignments: [
      {
        id: "NETWORK-001",
        clientId: "CLIENT-001",
        accountId: "ACCOUNT-001",
        deviceId: "DEVICE-001",
        state: "READY",
      },
    ],
  });
  const leases = new InMemoryDeviceLeaseStore(clock);
  const lease = await leases.acquire({
    jobId: "JOB-001",
    clientId: "CLIENT-001",
    accountId: "ACCOUNT-001",
    deviceId: "DEVICE-001",
    networkAssignmentId: "NETWORK-001",
    actorId: "MA1-TEST",
    correlationId: "CORR-001",
    ttlMs: 60_000,
  });
  const context: ExecutionContext = {
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
  return assemble({ clock, registry, leases, context, options });
}

function assemble(input: {
  clock: MutableClock;
  registry: InMemoryRegistry;
  leases: InMemoryDeviceLeaseStore;
  context: ExecutionContext;
  options: Parameters<typeof createOperatorHarness>[0];
}) {
  const evidence = new InMemoryEvidenceSink();
  const backend = new MockDeviceBackend(input.clock);
  backend.configure("DEVICE-001", {
    online: true,
    initialState: { foregroundApp: "SpringBoard" },
    ...input.options.device,
  });
  const policy: PolicyEvaluator = input.options.policy ?? {
    evaluate: async () => ({ outcome: "ALLOW", reason: "test allow" }),
  };
  const adapter = new FleetDeviceAdapter({
    context: input.context,
    registry: input.registry,
    leases: input.leases,
    policy,
    backend,
    evidence,
    audit: {
      operator: "mobile-agent-v3.5",
      upstreamSha: "11cea575561fb7800b5fb6b6cafa56f7a91de11f",
      model: "RECORDED_MODEL_FIXTURE",
      workflowRevision: "ma1-test-v1",
    },
    now: () => input.clock.now(),
  });
  const runtime = new RecordedMobileAgentRuntime(input.options.runtime);
  const operator = new MobileAgentPhoneOperator({
    runtime,
    device: adapter,
    model: "RECORDED_MODEL_FIXTURE",
  });
  const task: PhoneOperatorTask = {
    executionContext: input.context,
    instruction: "Open Settings and navigate harmless UI",
    limits: { maxSteps: 5, timeoutMs: 5_000, maxConsecutiveFailures: 2 },
    policyProfile: "test",
    verification: { name: "state_contains", expected: { foregroundApp: "Settings" } },
    workflowRevision: "ma1-test-v1",
    metadata: { fixture: "RECORDED_MODEL_FIXTURE" },
  };
  return { ...input, evidence, backend, policy, adapter, runtime, operator, task };
}
