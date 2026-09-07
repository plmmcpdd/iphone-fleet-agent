# Documentation index

## Read first

1. [Architecture baseline](architecture/IPHONE_FLEET_AGENT_ARCHITECTURE_v0.1.md)
2. [Phone Operator runtime boundary](architecture/PHONE_OPERATOR_RUNTIME.md)
3. [MA2 remote handoff](handoff/MA2_REMOTE_AGENT_HANDOFF.md)

## Architecture and contracts

- [Architecture baseline](architecture/IPHONE_FLEET_AGENT_ARCHITECTURE_v0.1.md) — canonical design and gate model.
- [Phone Operator runtime](architecture/PHONE_OPERATOR_RUNTIME.md) — ownership and execution-path boundary.
- [Fleet MCP Contract v0.1](mcp/fleet-mcp-v0.1.md) — stable external MCP boundary.
- [Harness compatibility contract](harness/compatibility-contract.md) — shared compatibility checks.

## Decisions and OSS evidence

- [ADRs](adr/README.md) — durable architecture decisions; ADR 0006 governs the experimental Mobile-Agent integration.
- [OSS evaluations](oss/README.md) — component selection records, including [MA1 Mobile-Agent / GUI-Owl](oss/2026-09-07-ma1-mobile-agent-gui-owl.md).
- [Upstream lock](../vendor/upstream-lock.json) — exact Mobile-Agent and GUI-Owl pins; checkout and weights are intentionally not vendored.

## POC evidence and handoffs

- [POC records](poc/README.md) — A1–A6, H0, and historical Phase A evidence.
- [MA1 Phone Operator report](poc/ma1-mobile-agent-phone-operator-report.md) — current implementation result and unresolved findings.
- [MA2 remote handoff](handoff/MA2_REMOTE_AGENT_HANDOFF.md) — ready-to-run remote-agent procedure; MA2 is not authorized by this document.
- [GH1 private GitHub handoff report](handoff/GH1_PRIVATE_GITHUB_HANDOFF_REPORT.md) — generated after remote verification.

## Historical vs current facts

The Phase A records and `main` freeze are historical evidence. The current implementation line is `feat/mobile-agent-phone-operator`, where `WorkflowEngine` is wired as the thin Hatchet adapter for `phone_operator_task`. MA1 remains mock/recorded-fixture only: real iOS, WDA/MobileNext, live GUI-Owl inference, and capacity scaling are not validated.
