# Agent Instructions

## Required reading order

Before changing code or running a real-device action, read these files in order:

1. `docs/architecture/IPHONE_FLEET_AGENT_ARCHITECTURE_v0.1.md`
2. `docs/architecture/PHONE_OPERATOR_RUNTIME.md`
3. `docs/adr/0006-mobile-agent-reference-phone-operator.md`
4. `docs/oss/2026-09-07-ma1-mobile-agent-gui-owl.md`
5. `docs/poc/ma1-mobile-agent-phone-operator-report.md`
6. `docs/handoff/MA2_REMOTE_AGENT_HANDOFF.md`

`E:\iphone-fleet-agent` is the historical Windows canonical workspace. A clean clone of this repository is the canonical source for a remote agent; do not create a parallel source tree.

## Non-negotiable boundaries

1. This project is completely independent of Ops Brain. Do not access, modify, copy, import, link, or depend on its source, customer state, runtime, configuration, or infrastructure.
2. Preserve the gate order: `A0 → A1 → A2 → A3 → A4 → A5 → A6 → H0 → M0+`. Do not enter the next gate without its review outcome.
3. Fleet owns device/account/network assignment, ExecutionContext, registry, lease/fencing, policy, scheduling, job lifecycle, evidence, and human gates. The Phone Operator receives exactly one bound device and never selects or discovers devices.
4. Every device side effect follows `proposal → normalization → Fleet Policy → Registry + lease/fencing validation → FleetDeviceAdapter → DeviceBackend`. Direct Mobile-Agent-to-ADB/WDA/DeviceBackend access is forbidden.
5. Fleet MCP is the stable product boundary. From H0.1, external protocol is versioned `Fleet MCP Contract v0.1`; harness-specific behavior must not enter `domain` or `control-plane`.
6. Any component beyond a thin adapter or business rule needs an OSS Evaluation using `docs/oss/0000-evaluation-template.md`. If A6/OpenAdapt fails, repeat evaluation; no self-built Flow Engine without an approved ADR.
7. Pin every third-party dependency and meet License/NOTICE obligations.

## Environment and MA2 guardrails

- Windows Native + PowerShell 7 is the primary environment. A0–A2 are Windows Native only; A3, A4, and A6 may use WSL Ubuntu-E; M0+ requires the macOS iOS Device Lab.
- MA1 is mock/recorded-fixture validation only. Real iOS, live GUI-Owl inference, MobileNext/WDA, and multi-phone capacity are unverified.
- MA2 may use only one dedicated iPhone with an explicit UDID and one mapped Fleet `deviceId`. Never select the first connected device.
- Run the Mac doctor first. `READY_FOR_HUMAN_GATES` is readiness only, never a real-iOS PASS. Stop on policy, identity, lease/fencing, WDA, Evidence, or human-gate mismatch.
