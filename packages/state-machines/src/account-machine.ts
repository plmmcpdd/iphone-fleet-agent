import { setup } from "xstate";

export type AccountEvent =
  | { type: "ACQUIRE" }
  | { type: "ASSIGN_DEVICE" }
  | { type: "BEGIN_LOGIN" }
  | { type: "LOGIN_SUCCEEDED" }
  | { type: "PROFILE_COMPLETED" }
  | { type: "WARMUP_COMPLETED" }
  | { type: "ACTIVATE" }
  | { type: "SESSION_EXPIRED" }
  | { type: "CHALLENGE" }
  | { type: "RESTRICT" }
  | { type: "DEGRADE" }
  | { type: "NEEDS_HUMAN" }
  | { type: "HUMAN_RESOLVED" }
  | { type: "RETIRE" };

export const accountMachine = setup({
  types: { events: {} as AccountEvent },
}).createMachine({
  id: "account-lifecycle",
  initial: "PROCUREMENT_PENDING",
  states: {
    PROCUREMENT_PENDING: { on: { ACQUIRE: "ACQUIRED", RETIRE: "RETIRED" } },
    ACQUIRED: { on: { ASSIGN_DEVICE: "DEVICE_ASSIGNED", RETIRE: "RETIRED" } },
    DEVICE_ASSIGNED: { on: { BEGIN_LOGIN: "LOGIN_PENDING", RETIRE: "RETIRED" } },
    LOGIN_PENDING: {
      on: { LOGIN_SUCCEEDED: "PROFILE_SETUP", CHALLENGE: "CHALLENGE", NEEDS_HUMAN: "NEEDS_HUMAN" },
    },
    PROFILE_SETUP: { on: { PROFILE_COMPLETED: "WARMUP", NEEDS_HUMAN: "NEEDS_HUMAN" } },
    WARMUP: { on: { WARMUP_COMPLETED: "READY", DEGRADE: "DEGRADED" } },
    READY: {
      on: {
        ACTIVATE: "ACTIVE",
        SESSION_EXPIRED: "SESSION_EXPIRED",
        CHALLENGE: "CHALLENGE",
        RESTRICT: "RESTRICTED",
        DEGRADE: "DEGRADED",
        RETIRE: "RETIRED",
      },
    },
    ACTIVE: {
      on: {
        SESSION_EXPIRED: "SESSION_EXPIRED",
        CHALLENGE: "CHALLENGE",
        RESTRICT: "RESTRICTED",
        DEGRADE: "DEGRADED",
        NEEDS_HUMAN: "NEEDS_HUMAN",
        RETIRE: "RETIRED",
      },
    },
    SESSION_EXPIRED: {
      on: { BEGIN_LOGIN: "LOGIN_PENDING", NEEDS_HUMAN: "NEEDS_HUMAN", RETIRE: "RETIRED" },
    },
    CHALLENGE: { on: { NEEDS_HUMAN: "NEEDS_HUMAN", RETIRE: "RETIRED" } },
    RESTRICTED: { on: { NEEDS_HUMAN: "NEEDS_HUMAN", RETIRE: "RETIRED" } },
    DEGRADED: { on: { WARMUP_COMPLETED: "READY", NEEDS_HUMAN: "NEEDS_HUMAN", RETIRE: "RETIRED" } },
    NEEDS_HUMAN: { on: { HUMAN_RESOLVED: "READY", RETIRE: "RETIRED" } },
    RETIRED: { type: "final" },
  },
});
