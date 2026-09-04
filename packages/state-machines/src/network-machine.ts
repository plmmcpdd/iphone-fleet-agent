import { setup } from "xstate";

export type NetworkEvent =
  | { type: "ASSIGN" }
  | { type: "BEGIN_VERIFY" }
  | { type: "VERIFY_SUCCEEDED" }
  | { type: "DEGRADE" }
  | { type: "RECOVER" }
  | { type: "GO_OFFLINE" }
  | { type: "COME_ONLINE" }
  | { type: "UNASSIGN" }
  | { type: "RETIRE" };

export const networkMachine = setup({
  types: { events: {} as NetworkEvent },
}).createMachine({
  id: "network-lifecycle",
  initial: "UNASSIGNED",
  states: {
    UNASSIGNED: { on: { ASSIGN: "ASSIGNED", RETIRE: "RETIRED" } },
    ASSIGNED: { on: { BEGIN_VERIFY: "VERIFYING", UNASSIGN: "UNASSIGNED", RETIRE: "RETIRED" } },
    VERIFYING: { on: { VERIFY_SUCCEEDED: "READY", DEGRADE: "DEGRADED", GO_OFFLINE: "OFFLINE" } },
    READY: {
      on: { DEGRADE: "DEGRADED", GO_OFFLINE: "OFFLINE", UNASSIGN: "UNASSIGNED", RETIRE: "RETIRED" },
    },
    DEGRADED: {
      on: { RECOVER: "READY", GO_OFFLINE: "OFFLINE", UNASSIGN: "UNASSIGNED", RETIRE: "RETIRED" },
    },
    OFFLINE: { on: { COME_ONLINE: "VERIFYING", UNASSIGN: "UNASSIGNED", RETIRE: "RETIRED" } },
    RETIRED: { type: "final" },
  },
});
