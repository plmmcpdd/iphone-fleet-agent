import type { WorkflowEngine } from "@iphone-fleet/application";
import type { ExecutionContext } from "@iphone-fleet/contracts";
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
  type MobileAgentProposal,
  RecordedMobileAgentRuntime,
} from "@iphone-fleet/mobile-agent-operator";
import { FleetDeviceAdapter, SafePhoneOperatorPolicy } from "@iphone-fleet/phone-operator";
import { FleetControlPlane } from "./fleet-control-plane.js";

export interface Ma1MockRuntimeOptions {
  readonly proposals?: readonly MobileAgentProposal[];
  readonly workflowEngine?: WorkflowEngine;
}

export function createMa1MockFleetRuntime(options: Ma1MockRuntimeOptions = {}) {
  const clock = new SystemClock();
  const registry = new InMemoryRegistry({
    devices: [
      {
        id: "DEVICE-MOCK-001",
        clientId: "CLIENT-DEMO",
        accountId: "ACCOUNT-DEMO-001",
        networkAssignmentId: "NETWORK-DEMO-001",
        state: "READY",
      },
    ],
    accounts: [
      {
        id: "ACCOUNT-DEMO-001",
        clientId: "CLIENT-DEMO",
        assignedDeviceId: "DEVICE-MOCK-001",
        networkAssignmentId: "NETWORK-DEMO-001",
        state: "READY",
      },
    ],
    networkAssignments: [
      {
        id: "NETWORK-DEMO-001",
        clientId: "CLIENT-DEMO",
        accountId: "ACCOUNT-DEMO-001",
        deviceId: "DEVICE-MOCK-001",
        state: "READY",
      },
    ],
  });
  const leases = new InMemoryDeviceLeaseStore(clock);
  const evidence = new InMemoryEvidenceSink();
  const backend = new MockDeviceBackend(clock);
  backend.configure("DEVICE-MOCK-001", {
    online: true,
    initialState: { foregroundApp: "SpringBoard" },
  });
  const safePolicy = new SafePhoneOperatorPolicy();
  const policy: PolicyEvaluator = {
    evaluate(context, action) {
      return action.name === "phone_operator_task"
        ? Promise.resolve({ outcome: "ALLOW", reason: "MA1 operator envelope" })
        : safePolicy.evaluate(context, action);
    },
  };
  const proposals = options.proposals ?? [
    { action: "open", text: "Settings", decisionSummary: "Open Settings" },
    { action: "terminate", status: "success", decisionSummary: "Navigation complete" },
  ];
  const controlPlane = new FleetControlPlane({
    registry,
    leases,
    evidence,
    backend,
    policy,
    clock,
    ...(options.workflowEngine ? { workflowEngine: options.workflowEngine } : {}),
    createPhoneOperator(context: ExecutionContext) {
      const device = new FleetDeviceAdapter({
        context,
        registry,
        leases,
        policy,
        backend,
        evidence,
        audit: {
          operator: "mobile-agent-v3.5",
          upstreamSha: "11cea575561fb7800b5fb6b6cafa56f7a91de11f",
          model: "RECORDED_MODEL_FIXTURE",
          workflowRevision: "ma1-mock-v1",
        },
      });
      return new MobileAgentPhoneOperator({
        runtime: new RecordedMobileAgentRuntime({ proposals }),
        device,
        model: "RECORDED_MODEL_FIXTURE",
      });
    },
  });
  return { controlPlane, registry, leases, evidence, backend, policy, clock };
}
