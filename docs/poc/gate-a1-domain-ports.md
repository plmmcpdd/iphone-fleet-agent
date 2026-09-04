# Gate A1 — Domain & Ports

- Status: PASS
- Date: 2026-09-04
- Environment: Windows Native, PowerShell 7, Node 24.14.1 via Corepack, pnpm 11.19.0

## Implemented

- Runtime-validated nine-field `ExecutionContext` contract.
- Device, Account and Network assignment domain records and error taxonomy.
- Fail-closed device authorization boundary and policy contract.
- DeviceBackend, DeviceLeaseStore, EvidenceSink, WorkflowEngine and RegistryReader ports.
- XState v5 Device, Account and Network lifecycle machines; no Job state machine.

## Verification

- Build: PASS
- Typecheck: PASS
- Biome lint/format check: PASS after correcting generated-output excludes and applying formatting.
- Unit: 4 PASS
- Contract: 10 PASS

## Failure injection

- Missing lease rejected.
- Stale fencing token rejected.
- Wrong device, account, network assignment and client rejected.
- Offline device rejected.
- Deny-by-default policy rejected.
- Invalid lifecycle events preserve the current state.

## Boundary evidence

Domain/contracts contain no Hatchet, OpenAdapt, Mobile MCP or Mobilewright private types. No Job lifecycle XState machine exists.

## Known environment detail

The Codex-bundled `pnpm.cmd` uses a bundled Node 24.19.0. Gate commands use the Windows baseline `D:\node\node.exe` 24.14.1 through `corepack pnpm`, without changing system configuration.
