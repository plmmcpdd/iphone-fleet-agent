# Gate A3 — PostgreSQL Registry & Lease

- Status: PASS
- Date: 2026-09-05
- Environment: Windows Native Node client against PostgreSQL 16.15 running user-local in WSL Ubuntu-E
- Database: disposable `fleet_test`; no Docker, cloud or system package installation

## Implemented

- node-pg-migrate schema for Client, Device, Account, Network Assignment, fencing counters and active Device Lease.
- PostgresRegistry implementing the existing RegistryReader port.
- PostgresDeviceLeaseStore implementing atomic acquire, renew, validate and release.
- Per-device transaction serialization using a PostgreSQL row lock and monotonically increasing `bigint` fencing counter.
- User-local WSL helper that downloads/extracts official Ubuntu packages without sudo and starts PostgreSQL on loopback port 55432.

## Verification

- PostgreSQL version: 16.15, Ubuntu package `16.15-0ubuntu0.24.04.1`.
- Build/typecheck: PASS.
- PostgreSQL integration: 6 PASS.
- Migration rerun: idempotent; one migration ledger row.
- Registry and active Lease remain readable through new Pool/repository instances.

## Failure injection and concurrency

- Two concurrent acquire attempts for one device: exactly one fulfilled and one `DEVICE_ALREADY_LEASED` rejection.
- Expired lease replacement increments the fencing token exactly once.
- Old fencing token rejected 20/20 validations.
- Context-matched renew and release succeed; released lease validates as missing.

## Fixes during Gate

- PostgreSQL initially failed because the system socket directory did not exist in the non-installed layout. The helper now places its Unix socket in the user-owned data root.
- Lease expiry validation uses PostgreSQL `now()` rather than the Windows process clock.
- Renew validates actor and correlation context as well as job/client/account/device/network/lease/token.

## Boundary evidence

No distributed lock service or scheduler was created. The implementation is a Fleet-specific repository/lease adapter over PostgreSQL transactions. PostgreSQL types do not enter domain/contracts.
