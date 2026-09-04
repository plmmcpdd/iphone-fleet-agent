import type { RegistryReader } from "@iphone-fleet/application";
import type { AccountId, DeviceId, NetworkAssignmentId } from "@iphone-fleet/contracts";
import type {
  AccountRecord,
  AccountState,
  DeviceRecord,
  DeviceState,
  NetworkAssignmentRecord,
  NetworkState,
} from "@iphone-fleet/domain";
import type { Pool } from "pg";

interface DeviceRow {
  id: string;
  client_id: string;
  account_id: string;
  network_assignment_id: string;
  state: DeviceState;
}

interface AccountRow {
  id: string;
  client_id: string;
  assigned_device_id: string;
  network_assignment_id: string;
  state: AccountState;
}

interface NetworkRow {
  id: string;
  client_id: string;
  account_id: string;
  device_id: string;
  state: NetworkState;
}

const mapDevice = (row: DeviceRow): DeviceRecord => ({
  id: row.id,
  clientId: row.client_id,
  accountId: row.account_id,
  networkAssignmentId: row.network_assignment_id,
  state: row.state,
});

const mapAccount = (row: AccountRow): AccountRecord => ({
  id: row.id,
  clientId: row.client_id,
  assignedDeviceId: row.assigned_device_id,
  networkAssignmentId: row.network_assignment_id,
  state: row.state,
});

const mapNetwork = (row: NetworkRow): NetworkAssignmentRecord => ({
  id: row.id,
  clientId: row.client_id,
  accountId: row.account_id,
  deviceId: row.device_id,
  state: row.state,
});

export class PostgresRegistry implements RegistryReader {
  public constructor(private readonly pool: Pool) {}

  public async getDevice(deviceId: DeviceId): Promise<DeviceRecord | undefined> {
    const result = await this.pool.query<DeviceRow>("SELECT * FROM devices WHERE id = $1", [
      deviceId,
    ]);
    return result.rows[0] ? mapDevice(result.rows[0]) : undefined;
  }

  public async getAccount(accountId: AccountId): Promise<AccountRecord | undefined> {
    const result = await this.pool.query<AccountRow>("SELECT * FROM accounts WHERE id = $1", [
      accountId,
    ]);
    return result.rows[0] ? mapAccount(result.rows[0]) : undefined;
  }

  public async getNetworkAssignment(
    networkAssignmentId: NetworkAssignmentId,
  ): Promise<NetworkAssignmentRecord | undefined> {
    const result = await this.pool.query<NetworkRow>(
      "SELECT * FROM network_assignments WHERE id = $1",
      [networkAssignmentId],
    );
    return result.rows[0] ? mapNetwork(result.rows[0]) : undefined;
  }

  public async listDevices(): Promise<readonly DeviceRecord[]> {
    const result = await this.pool.query<DeviceRow>("SELECT * FROM devices ORDER BY id");
    return result.rows.map(mapDevice);
  }

  public async findDevice(input: {
    readonly clientId: string;
    readonly accountId: string;
    readonly networkAssignmentId: string;
  }): Promise<DeviceRecord | undefined> {
    const result = await this.pool.query<DeviceRow>(
      `SELECT * FROM devices
       WHERE client_id = $1 AND account_id = $2 AND network_assignment_id = $3
       ORDER BY id LIMIT 1`,
      [input.clientId, input.accountId, input.networkAssignmentId],
    );
    return result.rows[0] ? mapDevice(result.rows[0]) : undefined;
  }
}
