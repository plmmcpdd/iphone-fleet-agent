# OSS Evaluation: A3 PostgreSQL persistence and migrations

- Status: Adopted for A3
- Date: 2026-09-05
- Related ADR: `docs/adr/0004-framework-responsibility-boundaries.md`

## Candidate

PostgreSQL 16.15, node-postgres (`pg`) 8.23.0, `@types/pg` 8.23.1 and node-pg-migrate 9.0.0.

## Official repository

- https://github.com/postgres/postgres
- https://github.com/brianc/node-postgres
- https://github.com/salsita/node-pg-migrate

## License

PostgreSQL License for PostgreSQL; MIT for node-postgres, `@types/pg` and node-pg-migrate.

## Activity

PostgreSQL 16.15 is the current Ubuntu 24.04 update package. All Node packages have current registry releases as checked on 2026-09-05.

## API / SDK

PostgreSQL supplies transactional row locking and durable state. node-postgres supplies the client/pool. node-pg-migrate owns migration ordering and the migration ledger.

## Self-host requirement

Yes. A3 uses a disposable local PostgreSQL process. No Docker or cloud resource is required.

## Platform requirements

The canonical source stays on Windows. Integration runs against PostgreSQL 16.15 in Ubuntu-E. With no sudo available, official Ubuntu packages are downloaded and extracted into ignored project-local runtime storage; the database data directory is user-local in Ubuntu-E.

## Overlap

PostgreSQL is the Registry and Lease state truth. It does not replace Hatchet workflow durability. The lease implementation is thin Fleet-specific transactional logic, not a general distributed lock service.

## Adapter feasibility

`PostgresRegistry` and `PostgresDeviceLeaseStore` implement the existing application ports; PostgreSQL and migration library types do not enter domain/contracts.

## Reasons for adoption/rejection

Adopted because row transactions, uniqueness and `FOR UPDATE` provide the required concurrency and fencing guarantees without a custom lock service. SQLite/PGlite are rejected for this Gate because the required proof targets real PostgreSQL semantics.

## Validation evidence

A3 WSL integration tests cover concurrent acquire, stale fencing, restart persistence, renew, validate, release and migration idempotency.
