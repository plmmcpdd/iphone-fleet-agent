import type { ExecutionContext } from "@iphone-fleet/contracts";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PostgresDeviceLeaseStore, PostgresRegistry, runFleetMigrations } from "../src/index.js";

const databaseUrl = process.env.FLEET_DATABASE_URL;
if (!databaseUrl)
  throw new Error("FLEET_DATABASE_URL is required for PostgreSQL integration tests");

const pool = new Pool({ connectionString: databaseUrl, max: 10 });
const request = {
  jobId: "JOB-PG-001",
  clientId: "CLIENT-PG",
  accountId: "ACCOUNT-PG-001",
  deviceId: "DEVICE-PG-001",
  networkAssignmentId: "NETWORK-PG-001",
  actorId: "postgres-integration",
  correlationId: "CORR-PG-001",
  ttlMs: 60_000,
};

const toContext = (
  lease: Awaited<ReturnType<PostgresDeviceLeaseStore["acquire"]>>,
): ExecutionContext => ({
  jobId: lease.jobId,
  clientId: lease.clientId,
  accountId: lease.accountId,
  deviceId: lease.deviceId,
  networkAssignmentId: lease.networkAssignmentId,
  leaseId: lease.leaseId,
  fencingToken: lease.fencingToken,
  actorId: lease.actorId,
  correlationId: lease.correlationId,
});

async function seedRegistry(): Promise<void> {
  await pool.query("BEGIN");
  try {
    await pool.query("SET CONSTRAINTS ALL DEFERRED");
    await pool.query("INSERT INTO clients (id) VALUES ($1)", [request.clientId]);
    await pool.query(
      `INSERT INTO devices (id, client_id, account_id, network_assignment_id, state)
       VALUES ($1,$2,$3,$4,'READY')`,
      [request.deviceId, request.clientId, request.accountId, request.networkAssignmentId],
    );
    await pool.query(
      `INSERT INTO accounts (id, client_id, assigned_device_id, network_assignment_id, state)
       VALUES ($1,$2,$3,$4,'READY')`,
      [request.accountId, request.clientId, request.deviceId, request.networkAssignmentId],
    );
    await pool.query(
      `INSERT INTO network_assignments (id, client_id, account_id, device_id, state)
       VALUES ($1,$2,$3,$4,'READY')`,
      [request.networkAssignmentId, request.clientId, request.accountId, request.deviceId],
    );
    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}

describe("PostgreSQL Registry and Device Lease", () => {
  beforeAll(async () => {
    await runFleetMigrations(databaseUrl);
  });

  beforeEach(async () => {
    await pool.query(
      "TRUNCATE device_leases, device_fencing, network_assignments, accounts, devices, clients CASCADE",
    );
    await seedRegistry();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("runs migrations idempotently through node-pg-migrate", async () => {
    await runFleetMigrations(databaseUrl);
    const result = await pool.query<{ count: string }>("SELECT count(*) FROM fleet_migrations");
    expect(Number(result.rows[0]?.count)).toBe(1);
  });

  it("persists Registry state across a new pool/repository instance", async () => {
    const restartedPool = new Pool({ connectionString: databaseUrl, max: 2 });
    try {
      const registry = new PostgresRegistry(restartedPool);
      await expect(registry.getDevice(request.deviceId)).resolves.toMatchObject({
        id: request.deviceId,
        accountId: request.accountId,
        networkAssignmentId: request.networkAssignmentId,
        state: "READY",
      });
      await expect(
        registry.findDevice({
          clientId: request.clientId,
          accountId: request.accountId,
          networkAssignmentId: request.networkAssignmentId,
        }),
      ).resolves.toMatchObject({ id: request.deviceId });
    } finally {
      await restartedPool.end();
    }
  });

  it("allows only one of two concurrent acquires for the same device", async () => {
    const store = new PostgresDeviceLeaseStore(pool);
    const results = await Promise.allSettled([
      store.acquire(request),
      store.acquire({ ...request, jobId: "JOB-PG-002", correlationId: "CORR-PG-002" }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({
      reason: { code: "DEVICE_ALREADY_LEASED" },
    });
  });

  it("does not overwrite an active lease when the preflight active check is bypassed", async () => {
    const store = new PostgresDeviceLeaseStore(pool);
    const first = await store.acquire(request);
    const fencingBefore = await pool.query<{ last_token: string }>(
      "SELECT last_token FROM device_fencing WHERE device_id = $1",
      [request.deviceId],
    );
    const bypassPool = {
      connect: async () => {
        const client = await pool.connect();
        return {
          query: async (query: string, values?: readonly unknown[]) => {
            if (
              query === "SELECT * FROM device_leases WHERE device_id = $1 AND expires_at > now()"
            ) {
              return { rows: [], rowCount: 0 };
            }
            return client.query(query, values as unknown[] | undefined);
          },
          release: () => client.release(),
        };
      },
    } as unknown as Pool;

    await expect(
      new PostgresDeviceLeaseStore(bypassPool).acquire({
        ...request,
        jobId: "JOB-PG-BYPASS",
        correlationId: "CORR-PG-BYPASS",
      }),
    ).rejects.toMatchObject({ code: "DEVICE_ALREADY_LEASED" });

    const persisted = await pool.query<{
      lease_id: string;
      job_id: string;
      fencing_token: string;
    }>("SELECT lease_id, job_id, fencing_token FROM device_leases WHERE device_id = $1", [
      request.deviceId,
    ]);
    expect(persisted.rows[0]).toEqual({
      lease_id: first.leaseId,
      job_id: first.jobId,
      fencing_token: String(first.fencingToken),
    });
    const fencingAfter = await pool.query<{ last_token: string }>(
      "SELECT last_token FROM device_fencing WHERE device_id = $1",
      [request.deviceId],
    );
    expect(fencingAfter.rows[0]?.last_token).toBe(fencingBefore.rows[0]?.last_token);
  });

  it("rejects every stale fencing token after lease replacement", async () => {
    const store = new PostgresDeviceLeaseStore(pool);
    const first = await store.acquire(request);
    await pool.query("UPDATE device_leases SET expires_at = now() - interval '1 second'");
    const second = await store.acquire({
      ...request,
      jobId: "JOB-PG-002",
      correlationId: "CORR-PG-002",
    });
    expect(second.fencingToken).toBe(first.fencingToken + 1);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await expect(store.validate(toContext(first))).resolves.toEqual({
        valid: false,
        reason: "STALE_FENCING_TOKEN",
      });
    }
  });

  it("renews, validates and releases an exact context", async () => {
    const store = new PostgresDeviceLeaseStore(pool);
    const lease = await store.acquire(request);
    const context = toContext(lease);
    const renewed = await store.renew(context, 120_000);
    expect(Date.parse(renewed.expiresAt)).toBeGreaterThan(Date.parse(lease.expiresAt));
    await expect(store.validate(context)).resolves.toMatchObject({ valid: true });
    await store.release(context);
    await expect(store.validate(context)).resolves.toEqual({ valid: false, reason: "MISSING" });
  });

  it("retains active Lease state across a new repository instance", async () => {
    const store = new PostgresDeviceLeaseStore(pool);
    const lease = await store.acquire(request);
    const restartedPool = new Pool({ connectionString: databaseUrl, max: 2 });
    try {
      const restartedStore = new PostgresDeviceLeaseStore(restartedPool);
      await expect(restartedStore.validate(toContext(lease))).resolves.toMatchObject({
        valid: true,
      });
    } finally {
      await restartedPool.end();
    }
  });
});
