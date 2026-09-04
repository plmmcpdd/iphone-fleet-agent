---
name: fleet-control
description: Submit and inspect iPhone Fleet Agent jobs through Fleet MCP or fleetctl when a task requires governed device execution or evidence retrieval.
---

# Fleet Control

Use Fleet MCP when available; otherwise use `fleetctl`. Never access PostgreSQL or a DeviceBackend directly.

Before submitting a job, obtain explicit `clientId`, `accountId`, `deviceId`, and `networkAssignmentId`. Do not infer a device from LLM memory. Include a unique `jobId`, `actorId`, `correlationId`, action, verification, and workflow revision.

Treat submission as successful only when the terminal job is `SUCCEEDED` and `fleet_get_evidence` returns matching verified evidence. If context, lease, fencing, policy, device health, verification, or evidence fails, preserve the failure and request human review when appropriate.

The Fleet MCP surface is `MCP Contract v0.1-draft`; inspect available tools instead of assuming long-term compatibility. Never claim mock or Windows validation proves real iOS behavior. Real-device work begins at the macOS Device Lab gates.
