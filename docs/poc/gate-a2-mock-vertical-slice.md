# Gate A2 — Mock Vertical Slice

- Status: PASS
- Date: 2026-09-05
- Environment: Windows Native, PowerShell 7, Node 24.14.1 via Corepack, pnpm 11.19.0
- Contract: MCP Contract v0.1-draft

## Implemented

- In-memory Registry, DeviceLeaseStore, EvidenceSink and JobStore.
- MockDeviceBackend with explicit `deviceId` and deterministic state verification.
- FleetControlPlane application service with resolve, lease, authorization, action, verify, evidence, terminal state and release.
- Minimal `fleetctl` executable with a complete `demo` path.
- Seven draft Fleet MCP tools over the official TypeScript SDK and stdio/in-memory transports.

## Verification

- Full Windows `pnpm verify`: PASS.
- Unit: 5 PASS.
- Contract: 15 PASS before the final MCP submit/evidence assertion; final count recorded by checkpoint verification.
- e2e-mock: 7 PASS.
- Manual `fleetctl demo JOB-MANUAL-SMOKE`: SUCCEEDED with one terminal success Evidence record.

## Failure injection

- Wrong device, wrong account and wrong network assignment: FAILED with Evidence.
- Stale and expired lease: FAILED with Evidence.
- Device offline and verification failure: FAILED with Evidence.
- Evidence persistence failure: never returns success.
- Lease release failure: terminal Job becomes FAILED and records release failure Evidence.

## Fixes during Gate

- Added explicit pnpm 11 `allowBuilds` for the exact esbuild transitive install script.
- Added explicit Node global types for TypeScript 7.
- Corrected workspace test discovery for `apps/` and package-owned e2e tests.
- Corrected Windows ESM CLI entrypoint detection with `pathToFileURL`.
- Removed an early-return/finally path that could have returned a stale success object after lease release failure.

## Boundary evidence

MCP SDK types remain in `apps/fleet-mcp`; no MCP private types enter domain/contracts. No database, Hatchet or real device is used. Windows mock success is not real iOS verification.
