import type { AccountId, ClientId, DeviceId, NetworkAssignmentId } from "@iphone-fleet/contracts";

export const deviceStates = [
  "DISCOVERED",
  "ENROLLING",
  "READY",
  "BUSY",
  "DEGRADED",
  "NEEDS_HUMAN",
  "OFFLINE",
  "RETIRED",
] as const;
export type DeviceState = (typeof deviceStates)[number];

export const accountStates = [
  "PROCUREMENT_PENDING",
  "ACQUIRED",
  "DEVICE_ASSIGNED",
  "LOGIN_PENDING",
  "PROFILE_SETUP",
  "WARMUP",
  "READY",
  "ACTIVE",
  "SESSION_EXPIRED",
  "CHALLENGE",
  "RESTRICTED",
  "DEGRADED",
  "NEEDS_HUMAN",
  "RETIRED",
] as const;
export type AccountState = (typeof accountStates)[number];

export const networkStates = [
  "UNASSIGNED",
  "ASSIGNED",
  "VERIFYING",
  "READY",
  "DEGRADED",
  "OFFLINE",
  "RETIRED",
] as const;
export type NetworkState = (typeof networkStates)[number];

export interface DeviceRecord {
  readonly id: DeviceId;
  readonly clientId: ClientId;
  readonly accountId: AccountId;
  readonly networkAssignmentId: NetworkAssignmentId;
  readonly state: DeviceState;
}

export interface AccountRecord {
  readonly id: AccountId;
  readonly clientId: ClientId;
  readonly assignedDeviceId: DeviceId;
  readonly networkAssignmentId: NetworkAssignmentId;
  readonly state: AccountState;
}

export interface NetworkAssignmentRecord {
  readonly id: NetworkAssignmentId;
  readonly clientId: ClientId;
  readonly accountId: AccountId;
  readonly deviceId: DeviceId;
  readonly state: NetworkState;
}
