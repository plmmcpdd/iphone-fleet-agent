import { setup } from "xstate";

export type DeviceEvent =
  | { type: "BEGIN_ENROLLMENT" }
  | { type: "ENROLLMENT_SUCCEEDED" }
  | { type: "RESERVE" }
  | { type: "RELEASE" }
  | { type: "DEGRADE" }
  | { type: "RECOVER" }
  | { type: "NEEDS_HUMAN" }
  | { type: "HUMAN_RESOLVED" }
  | { type: "GO_OFFLINE" }
  | { type: "COME_ONLINE" }
  | { type: "RETIRE" };

export const deviceMachine = setup({
  types: { events: {} as DeviceEvent },
}).createMachine({
  id: "device-lifecycle",
  initial: "DISCOVERED",
  states: {
    DISCOVERED: { on: { BEGIN_ENROLLMENT: "ENROLLING", RETIRE: "RETIRED" } },
    ENROLLING: {
      on: {
        ENROLLMENT_SUCCEEDED: "READY",
        DEGRADE: "DEGRADED",
        GO_OFFLINE: "OFFLINE",
      },
    },
    READY: {
      on: {
        RESERVE: "BUSY",
        DEGRADE: "DEGRADED",
        NEEDS_HUMAN: "NEEDS_HUMAN",
        GO_OFFLINE: "OFFLINE",
        RETIRE: "RETIRED",
      },
    },
    BUSY: {
      on: {
        RELEASE: "READY",
        DEGRADE: "DEGRADED",
        NEEDS_HUMAN: "NEEDS_HUMAN",
        GO_OFFLINE: "OFFLINE",
      },
    },
    DEGRADED: {
      on: {
        RECOVER: "READY",
        NEEDS_HUMAN: "NEEDS_HUMAN",
        GO_OFFLINE: "OFFLINE",
        RETIRE: "RETIRED",
      },
    },
    NEEDS_HUMAN: {
      on: { HUMAN_RESOLVED: "READY", GO_OFFLINE: "OFFLINE", RETIRE: "RETIRED" },
    },
    OFFLINE: { on: { COME_ONLINE: "READY", RETIRE: "RETIRED" } },
    RETIRED: { type: "final" },
  },
});
