# ADR 0006: Mobile-Agent-v3.5 as Reference Phone Operator Runtime

- Status: Accepted for experimental integration
- Date: 2026-09-07
- Upstream pin: `vendor/upstream-lock.json`
- OSS Evaluation: `docs/oss/2026-09-07-ma1-mobile-agent-gui-owl.md`

## Context

Fleet needs flexible per-device GUI reasoning without making an Agent responsible for fleet ownership. Mobile-Agent-v3.5 provides GUI-Owl-based action selection and short-term GUI context, but its released mobile runner is directly coupled to Android ADB and officially does not yet support iOS.

## Decision

Adopt Mobile-Agent-v3.5 as the reference experimental per-device Phone Operator intelligence behind a vendor-neutral `PhoneOperator` port. One invocation binds exactly one `ExecutionContext`, `deviceId`, `leaseId` and `fencingToken`. The operator receives no fleet inventory and cannot select, discover or switch devices.

Fleet owns device/account/network assignment, ExecutionContext, Registry, Lease/fencing, Policy, Job lifecycle, scheduling, concurrency, Evidence authority and Human Gate. Mobile-Agent owns per-device GUI planning, progress, action proposal, short-term context and GUI-level recovery. `DeviceBackend` owns actual observation and side effects. GUI-Owl owns only model inference.

Every side effect follows:

```text
Mobile-Agent proposal
→ vendor-neutral normalization
→ Fleet Policy
→ Registry + Lease/fencing validation
→ FleetDeviceAdapter
→ DeviceBackend
```

`Mobile-Agent → WDA/ADB/DeviceBackend` direct access is prohibited.

## Internal process boundary

Use deterministic JSONL over stdio between TypeScript and a per-device Python worker. JSONL was selected over localhost IPC because it has no listening port, works on Windows/macOS, separates stdout protocol from stderr diagnostics, and gives process-crash isolation. Each frame carries protocol version, request ID and correlation ID. The TypeScript supervisor owns timeouts, cancellation, backpressure (one in-flight request), crash detection and redaction.

The default safety model is one Python process per active operator session/device. A multi-session worker is deferred until measured capacity data proves that Python global/model state can be safely isolated. No public HTTP API and no second MCP are introduced.

## Model boundary

Fleet types identify a provider-neutral model configuration. The Mobile-Agent package may translate it to the upstream OpenAI-compatible/vLLM/SGLang client. Secrets come only from environment or a future secret provider and never appear in task frames or Evidence. MA1 uses `RECORDED_MODEL_FIXTURE`; live GUI-Owl weights/endpoints are not tested.

## Consequences

- Fleet MCP v0.1 remains unchanged and frozen.
- Hatchet remains the durable Job/workflow owner; PhoneOperator status is an execution result, not another Job state machine.
- The upstream checkout remains gitignored and unmodified; the target is no long-term fork.
- Official upstream iOS absence remains a high finding for MA2, not a reason to bypass FleetDeviceAdapter.

## Revisit triggers

Re-evaluate if upstream adds an official environment protocol, if the adapter requires a core fork, if licensing changes, if per-device processes do not meet measured capacity, or if MA2 cannot drive one explicit iPhone through MobileNext/WDA without violating this boundary.
