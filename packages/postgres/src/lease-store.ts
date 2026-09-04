import { randomUUID } from "node:crypto";
import type {
  DeviceLease,
  DeviceLeaseStore,
  LeaseAcquireRequest,
  LeaseInvalidReason,
  LeaseValidation,
} from "@iphone-fleet/application";
import type { ExecutionContext } from "@iphone-fleet/contracts";
import { FleetError } from "@iphone-fleet/domain";
import type { Pool } from "pg";

interface LeaseRow {
  lease_id: string;
  job_id: string;
  client_id: string;
  account_id: string;
  device_id: string;
  network_assignment_id: string;
  actor_id: string;
  correlation_id: string;
  fencing_token: string;
  expires_at: Date;
  is_expired?: boolean;
}

const mapLease = (row: LeaseRow): DeviceLease => ({
  leaseId: row.lease_id,
  jobId: row.job_id,
  clientId: row.client_id,
  accountId: row.account_id,
  deviceId: row.device_id,
  networkAssignmentId: row.network_assignment_id,
  actorId: row.actor_id,
  correlationId: row.correlation_id,
  fencingToken: Number(row.fencing_token),
  expiresAt: row.expires_at.toISOString(),
});

export class PostgresDeviceLeaseStore implements DeviceLeaseStore {
  public constructor(private readonly pool: Pool) {}

  public async acquire(request: LeaseAcquireRequest): Promise<DeviceLease> {
    if (!Number.isInteger(request.ttlMs) || request.ttlMs <= 0) {
      throw new FleetError("LEASE_REQUIRED", "Lease TTL must be a positive integer");
    }
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "INSERT INTO device_fencing (device_id, last_token) VALUES ($1, 0) ON CONFLICT DO NOTHING",
        [request.deviceId],
      );
      await client.query("SELECT last_token FROM device_fencing WHERE device_id = $1 FOR UPDATE", [
        request.deviceId,
      ]);
      const active = await client.query<LeaseRow>(
        "SELECT * FROM device_leases WHERE device_id = $1 AND expires_at > now()",
        [request.deviceId],
      );
      if (active.rows[0]) {
        throw new FleetError(
          "DEVICE_ALREADY_LEASED",
          `Device ${request.deviceId} is already leased`,
        );
      }
      const token = await client.query<{ last_token: string }>(
        "UPDATE device_fencing SET last_token = last_token + 1 WHERE device_id = $1 RETURNING last_token",
        [request.deviceId],
      );
      const fencingToken = Number(token.rows[0]?.last_token);
      if (!Number.isSafeInteger(fencingToken) || fencingToken <= 0) {
        throw new FleetError(
          "STALE_FENCING_TOKEN",
          "Fencing token exceeded the safe integer range",
        );
      }
      const result = await client.query<LeaseRow>(
        `INSERT INTO device_leases (
          device_id, lease_id, job_id, client_id, account_id, network_assignment_id,
          actor_id, correlation_id, fencing_token, expires_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now() + ($10 * interval '1 millisecond'))
        ON CONFLICT (device_id) DO UPDATE SET
          lease_id = EXCLUDED.lease_id,
          job_id = EXCLUDED.job_id,
          client_id = EXCLUDED.client_id,
          account_id = EXCLUDED.account_id,
          network_assignment_id = EXCLUDED.network_assignment_id,
          actor_id = EXCLUDED.actor_id,
          correlation_id = EXCLUDED.correlation_id,
          fencing_token = EXCLUDED.fencing_token,
          expires_at = EXCLUDED.expires_at,
          updated_at = now()
        RETURNING *`,
        [
          request.deviceId,
          `LEASE-${randomUUID()}`,
          request.jobId,
          request.clientId,
          request.accountId,
          request.networkAssignmentId,
          request.actorId,
          request.correlationId,
          fencingToken,
          request.ttlMs,
        ],
      );
      await client.query("COMMIT");
      const row = result.rows[0];
      if (!row) throw new FleetError("LEASE_REQUIRED", "Lease insert returned no row");
      return mapLease(row);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async renew(context: ExecutionContext, ttlMs: number): Promise<DeviceLease> {
    const result = await this.pool.query<LeaseRow>(
      `UPDATE device_leases SET expires_at = now() + ($10 * interval '1 millisecond'), updated_at = now()
       WHERE device_id=$1 AND lease_id=$2 AND job_id=$3 AND client_id=$4 AND account_id=$5
         AND network_assignment_id=$6 AND fencing_token=$7 AND actor_id=$8
         AND correlation_id=$9 AND expires_at > now()
       RETURNING *`,
      [
        context.deviceId,
        context.leaseId,
        context.jobId,
        context.clientId,
        context.accountId,
        context.networkAssignmentId,
        context.fencingToken,
        context.actorId,
        context.correlationId,
        ttlMs,
      ],
    );
    const row = result.rows[0];
    if (!row) {
      const validation = await this.validate(context);
      throw this.validationError(validation.valid ? "CONTEXT_MISMATCH" : validation.reason);
    }
    return mapLease(row);
  }

  public async validate(context: ExecutionContext): Promise<LeaseValidation> {
    const result = await this.pool.query<LeaseRow>(
      "SELECT *, expires_at <= now() AS is_expired FROM device_leases WHERE device_id = $1",
      [context.deviceId],
    );
    const row = result.rows[0];
    if (!row) return { valid: false, reason: "MISSING" };
    if (row.is_expired) return { valid: false, reason: "EXPIRED" };
    const token = Number(row.fencing_token);
    if (context.fencingToken !== token) {
      return context.fencingToken < token
        ? { valid: false, reason: "STALE_FENCING_TOKEN" }
        : { valid: false, reason: "CONTEXT_MISMATCH" };
    }
    const lease = mapLease(row);
    const fields = [
      "leaseId",
      "jobId",
      "clientId",
      "accountId",
      "deviceId",
      "networkAssignmentId",
      "actorId",
      "correlationId",
    ] as const;
    if (fields.some((field) => context[field] !== lease[field])) {
      return { valid: false, reason: "CONTEXT_MISMATCH" };
    }
    return { valid: true, lease };
  }

  public async release(context: ExecutionContext): Promise<void> {
    const result = await this.pool.query(
      `DELETE FROM device_leases
       WHERE device_id=$1 AND lease_id=$2 AND fencing_token=$3
         AND job_id=$4 AND client_id=$5 AND account_id=$6 AND network_assignment_id=$7
       RETURNING device_id`,
      [
        context.deviceId,
        context.leaseId,
        context.fencingToken,
        context.jobId,
        context.clientId,
        context.accountId,
        context.networkAssignmentId,
      ],
    );
    if (result.rowCount !== 1) {
      const validation = await this.validate(context);
      throw this.validationError(validation.valid ? "CONTEXT_MISMATCH" : validation.reason);
    }
  }

  private validationError(reason: LeaseInvalidReason): FleetError {
    const code = {
      MISSING: "LEASE_REQUIRED",
      EXPIRED: "LEASE_EXPIRED",
      STALE_FENCING_TOKEN: "STALE_FENCING_TOKEN",
      CONTEXT_MISMATCH: "LEASE_CONTEXT_MISMATCH",
    } as const;
    return new FleetError(code[reason], `Lease validation failed: ${reason}`);
  }
}
