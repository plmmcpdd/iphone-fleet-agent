import type { EvidenceSink } from "@iphone-fleet/application";
import type { PolicyEvaluator } from "@iphone-fleet/domain";
import {
  InMemoryDeviceLeaseStore,
  InMemoryEvidenceSink,
  InMemoryRegistry,
  MockDeviceBackend,
  SystemClock,
} from "@iphone-fleet/inmemory";
import { FleetControlPlane } from "./fleet-control-plane.js";

export function createMockFleetRuntime(options: { evidence?: EvidenceSink } = {}) {
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
  const evidence = options.evidence ?? new InMemoryEvidenceSink();
  const backend = new MockDeviceBackend(clock);
  backend.configure("DEVICE-MOCK-001", { online: true, initialState: { screen: "home" } });
  const policy: PolicyEvaluator = {
    async evaluate(_context, action) {
      return action.name === "set_state"
        ? { outcome: "ALLOW", reason: "Mock demo allow-list" }
        : { outcome: "DENY", reason: `Action ${action.name} is not allow-listed` };
    },
  };
  const controlPlane = new FleetControlPlane({
    registry,
    leases,
    evidence,
    backend,
    policy,
    clock,
  });
  return { controlPlane, registry, leases, evidence, backend, policy, clock };
}
