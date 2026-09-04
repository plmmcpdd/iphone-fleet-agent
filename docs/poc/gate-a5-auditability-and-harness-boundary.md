# Gate A5 — Evidence, OpenTelemetry, Skill and Harness Boundary

- Status: PASS
- Date: 2026-09-05
- Environment: Windows Native

## Implemented

- Local Evidence adapter with atomic directory publication, JSON artifacts, persistent metadata and SHA-256 digests.
- Digest verification on read and fail-closed behavior for tampering, unsafe identifiers and caller-forged artifact metadata.
- Vendor-neutral OTel spans around device action, verification and Evidence append.
- A minimal Agent Skills-compatible `skills/fleet-control/SKILL.md`.
- Static package-boundary contract proving fleetctl and Fleet MCP reach capability only through the Control Plane facade.

## Verification

- Local Evidence integration: 4 PASS.
- OTel integration: 2 PASS, including a real mock Control Plane submission.
- Harness boundary contract: 2 PASS.
- Fleet MCP official in-memory transport smoke remains PASS and retrieves successful evidence.
- Skill structural validation: PASS.
- Unified Windows build/typecheck/lint/unit/contract/e2e-mock: PASS.

## Failure injection

- Corrupted artifact bytes are rejected with a digest mismatch.
- Unsafe path segments and caller-supplied digests are rejected.
- An injected tracing exception produces an ERROR span and is rethrown.

## Fixes during Gate

- Captured the acquired ExecutionContext in an immutable local before passing it to traced async closures, preserving strict TypeScript narrowing.
- Added an explicit directory-entry type to avoid implicit-any behavior in filesystem enumeration.

## Boundary evidence

No observability platform or Skill Registry Server was created. Harness packages have no PostgreSQL, Lease Store, DeviceBackend or Hatchet dependency. Langfuse remains deferred.
