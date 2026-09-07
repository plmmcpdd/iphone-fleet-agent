# Fleet MCP Contract v0.1

Fleet MCP is the Harness-independent product boundary. H0 supports local stdio only.

## Start

From the repository root:

```text
pnpm build
pnpm --filter @iphone-fleet/fleet-mcp start
```

`start` executes the built server at `apps/fleet-mcp/dist/main.js`. Standard MCP JSON-RPC uses stdout; diagnostics must use stderr. H0 starts a mock runtime and reports `runtime: "mock"`; it is not a production or real-iOS endpoint.

## Result envelope

Successful calls include both MCP text content and equivalent `structuredContent`:

```json
{
  "contractVersion": "0.1",
  "runtime": "mock",
  "ok": true,
  "humanRequired": false,
  "data": {}
}
```

`ok: true` means the MCP tool invocation completed; it does not mean a submitted job succeeded. A Harness may report job success only when `job.state` is `SUCCEEDED` and matching evidence exists.

Tool failures set MCP `isError: true` and return JSON text:

```json
{
  "contractVersion": "0.1",
  "runtime": "mock",
  "ok": false,
  "error": {
    "code": "JOB_NOT_FOUND",
    "message": "Job ... was not found",
    "retryable": false,
    "humanRequired": false
  }
}
```

Input-schema violations remain standard MCP invalid-params errors. Fleet failures use the domain taxonomy: context/device/account/network mismatch, lifecycle, lease/fencing, policy, human gate, device health, verification, evidence, and job-not-found errors. Unexpected tool failures are `INTERNAL_ERROR`; no PostgreSQL, Hatchet, or DeviceBackend details are exposed.

## Tools

| Tool | Data member | Semantics |
| --- | --- | --- |
| `fleet_status` | `status` | Service counts and runtime identity |
| `fleet_list_devices` | `devices` | Explicit Fleet assignments |
| `fleet_find_device` | `device` | Exact client/account/network match or `null` |
| `fleet_submit_job` | `job` | Governed action, verification, evidence, terminal state |
| `fleet_get_job` | `job` | Job, context, terminal error if any |
| `fleet_get_evidence` | `evidence` | Ordered audit records; empty never proves success |
| `fleet_request_human` | `job` | Sets `NEEDS_HUMAN`, emits evidence, returns `humanRequired: true` |

All write submissions require explicit `jobId`, `clientId`, `accountId`, `deviceId`, `networkAssignmentId`, `actorId`, and `correlationId`. Lease identifiers and fencing tokens returned in job/evidence context are opaque audit fields; a Harness must not create, alter, or use them to bypass Fleet.

## H0 changes from v0.1-draft

No tool was added, removed, merged, or renamed. H0 adds detailed descriptions, field descriptions, operation annotations, output schemas, structured envelopes, explicit mock identity, consistent errors, and explicit HUMAN_REQUIRED semantics. Array results are wrapped under named data members. The MCP version string was removed from Control Plane status and is now owned by the MCP layer.
