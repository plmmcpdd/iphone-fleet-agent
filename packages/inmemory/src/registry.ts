import type { RegistryReader } from "@iphone-fleet/application";
import type { AccountId, DeviceId, NetworkAssignmentId } from "@iphone-fleet/contracts";
import type { AccountRecord, DeviceRecord, NetworkAssignmentRecord } from "@iphone-fleet/domain";

export interface RegistrySeed {
  readonly devices: readonly DeviceRecord[];
  readonly accounts: readonly AccountRecord[];
  readonly networkAssignments: readonly NetworkAssignmentRecord[];
}

export class InMemoryRegistry implements RegistryReader {
  private readonly devices = new Map<DeviceId, DeviceRecord>();
  private readonly accounts = new Map<AccountId, AccountRecord>();
  private readonly networks = new Map<NetworkAssignmentId, NetworkAssignmentRecord>();

  public constructor(seed: RegistrySeed) {
    for (const device of seed.devices) this.devices.set(device.id, device);
    for (const account of seed.accounts) this.accounts.set(account.id, account);
    for (const network of seed.networkAssignments) this.networks.set(network.id, network);
  }

  public async getDevice(deviceId: DeviceId): Promise<DeviceRecord | undefined> {
    return this.devices.get(deviceId);
  }

  public async getAccount(accountId: AccountId): Promise<AccountRecord | undefined> {
    return this.accounts.get(accountId);
  }

  public async getNetworkAssignment(
    networkAssignmentId: NetworkAssignmentId,
  ): Promise<NetworkAssignmentRecord | undefined> {
    return this.networks.get(networkAssignmentId);
  }

  public async listDevices(): Promise<readonly DeviceRecord[]> {
    return [...this.devices.values()];
  }

  public async findDevice(input: {
    readonly clientId: string;
    readonly accountId: string;
    readonly networkAssignmentId: string;
  }): Promise<DeviceRecord | undefined> {
    return [...this.devices.values()].find(
      (device) =>
        device.clientId === input.clientId &&
        device.accountId === input.accountId &&
        device.networkAssignmentId === input.networkAssignmentId,
    );
  }

  public setDevice(record: DeviceRecord): void {
    this.devices.set(record.id, record);
  }

  public setAccount(record: AccountRecord): void {
    this.accounts.set(record.id, record);
  }

  public setNetworkAssignment(record: NetworkAssignmentRecord): void {
    this.networks.set(record.id, record);
  }
}
