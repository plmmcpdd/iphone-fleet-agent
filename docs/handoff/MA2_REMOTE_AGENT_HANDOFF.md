# MA2 — Remote Agent Handoff

> Status: **MA1 is complete. MA2 is prepared, not started, and requires owner approval plus a dedicated macOS iOS Device Lab.** This document does not authorize a real-device action.

## 1. Executive status

The governed MA1 Phone Operator integration passed its mock/recorded-fixture verification on `feat/mobile-agent-phone-operator` at `88bfcd54e725d7257ce59249eec1cabc5bbb2e29`. Real iOS, WDA/MobileNext, live GUI-Owl inference, and capacity are untested.

## 2. Scope of this handoff

This is a reproducible remote-agent entrypoint for the **one-phone MA2 POC only**. It transfers documentation and verification context; it does not transfer credentials, devices, accounts, customer data, model weights, or runtime state.

## 3. Required reading order

Read, in order: architecture baseline; Phone Operator runtime; ADR 0006; MA1 OSS evaluation; MA1 report; then this file. The same sequence is enforced in [`AGENTS.md`](../../AGENTS.md).

## 4. Repository identity and revisions

| Item | Value |
| --- | --- |
| Active implementation branch | `feat/mobile-agent-phone-operator` |
| MA1 HEAD | `88bfcd54e725d7257ce59249eec1cabc5bbb2e29` |
| Frozen `main` | `04856398838d6af1b89ddebfcfbc80afd463dc65` |
| Freeze tag | annotated `fleet-mcp-v0.1-freeze` |
| Package manager | `pnpm@11.19.0` via Corepack |
| Node engine | `24.14.1` |

Use a clean clone; do not rely on `E:\iphone-fleet-agent`, which is only the historical Windows canonical workspace.

## 5. Architecture baseline

[`docs/architecture/IPHONE_FLEET_AGENT_ARCHITECTURE_v0.1.md`](../architecture/IPHONE_FLEET_AGENT_ARCHITECTURE_v0.1.md) is the architecture baseline. It defines a safe, auditable multi-iPhone Fleet with a per-device operator, not an unrestricted agent controlling an arbitrary device.

## 6. Gate status

`A0 → A1 → A2 → A3 → A4 → A5 → A6 → H0` are historical completed POCs. `MA1` is complete with findings. `MA2` is the next proposed one-iPhone POC. Do not skip to MA3–MA6 or infer production readiness.

## 7. Ownership model

Fleet owns device/account/network assignment, ExecutionContext, Registry, Lease/fencing, Policy, Job lifecycle, Hatchet scheduling, Evidence, and Human Gates. Mobile-Agent owns only one-device GUI planning/proposal and short-term GUI recovery. DeviceBackend owns observation and side effects.

## 8. Side-effect enforcement path

Every action must take this path:

```text
Mobile-Agent proposal → normalization → Fleet Policy → Registry + lease/fencing
→ FleetDeviceAdapter → DeviceBackend → verification → Evidence
```

Direct Mobile-Agent access to ADB, WDA, MobileNext, or DeviceBackend is prohibited.

## 9. ExecutionContext and identity binding

Each invocation binds exactly one `jobId`, `clientId`, `accountId`, `deviceId`, `networkAssignmentId`, `leaseId`, `fencingToken`, `actorId`, and `correlationId`. Treat any mismatch as fail-closed; do not repair it by selecting another device or regenerating identifiers.

## 10. Fleet MCP product boundary

Fleet MCP is the stable external product boundary, versioned `Fleet MCP Contract v0.1`. Its frozen tools are `fleet_status`, `fleet_list_devices`, `fleet_find_device`, `fleet_submit_job`, `fleet_get_job`, `fleet_get_evidence`, and `fleet_request_human`. Harness differences must remain outside domain/control-plane.

## 11. MA1 implementation result

MA1 proved the mock path Fleet MCP → Control Plane → embedded Hatchet → Mobile-Agent PhoneOperator → recorded Python JSONL worker → FleetDeviceAdapter → mock backend → verification/Evidence. It also proved architecture boundary contracts and one-device worker binding.

## 12. Mobile-Agent integration boundary

The upstream checkout is unmodified and gitignored. TypeScript supervises one Python worker per active device session over JSONL/stdio; stdout is protocol and stderr is diagnostics. MA1 enables only `RECORDED_MODEL_FIXTURE`; it is not a live upstream planner/model run.

## 13. Upstream pin and license

Read [`vendor/upstream-lock.json`](../../vendor/upstream-lock.json) and the [MA1 OSS evaluation](../oss/2026-09-07-ma1-mobile-agent-gui-owl.md). Mobile-Agent-v3.5 is pinned at `11cea575561fb7800b5fb6b6cafa56f7a91de11f` (MIT); GUI-Owl is pinned at `06d5faecff74840bab2be2425e9c42667a5d04fc` (MIT; base Qwen3-VL Apache-2.0). Model weights are not downloaded or vendored.

## 14. Upstream iOS limitation

The released upstream mobile runner officially targets Android/ADB. MA2 must validate a vendor-neutral `MobileNextDeviceBackend` / WDA path without bypassing FleetDeviceAdapter. If that seam requires core upstream modification, stop and repeat OSS Evaluation before proposing a patch.

## 15. MA1 high findings

1. iOS compatibility is unproven.
2. Live GUI-Owl inference is untested.
3. A long durable human wait can outlive the Control Plane lease. MA2 must define lease renewal or release/reacquire plus a rebuilt ExecutionContext before resuming real-device work.

## 16. MA1 medium and low findings

The worker is fixture/protocol-only; Hatchet-to-child cancellation needs production composition; process capacity is unmeasured. Embedded Hatchet has transient teardown noise. OpenAdapt’s synthetic PHI scrubber warning remains relevant: do not use human data until Evidence/privacy policy is fail-closed.

## 17. Environment topology

Windows Native + PowerShell 7 is primary; A0–A2 were Windows Native. A3/A4/A6 may use WSL Ubuntu-E. Real iOS requires macOS Device Lab at M0+. MA2 must run on the Mac lab, but source remains this clean repository clone.

## 18. Secret and privacy boundary

No secrets belong in commits, JSONL task frames, Evidence, logs, screenshots, or issue text. Supply model credentials only through the environment or a future approved secret provider. Do not retain hidden model reasoning. Use dedicated non-production accounts and approved test data only.

## 19. Repository hygiene

`.gitignore` excludes runtime/cache/evidence, local credentials/signing files, model/checkpoint directories and common macOS build products. Do not add generated `node_modules`, `.runtime`, model weights, WDA build output, device screenshots, or device pairing material to Git.

## 20. Baseline verification

From a clean clone run:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm verify
```

Expected: build, typecheck, lint, unit, contract, MCP black-box, local/mock E2E, PostgreSQL, Hatchet, and OpenAdapt checks pass. Expected teardown/warning noise must not be reclassified as a pass/fail without checking assertions.

## 21. Real-iOS guard

`pnpm real-ios:e2e` is intentionally blocked before M0+. A passing mock test or doctor does not count as iOS E2E. Never alter that guard merely to make a pipeline green.

## 22. MA2 authorized target shape

Use exactly one dedicated iPhone SE2 (or an owner-approved equivalent) with one explicit UDID mapped to one Fleet `deviceId`. Never use “first connected device.” Use one dedicated test account and approved network assignment bound in the ExecutionContext.

## 23. Mac prerequisites

Record macOS, Xcode, iOS, device model, WDA, MobileNext/mobilecli, Fleet revision, test account class, and network assumption. Configure Xcode command-line tools and WDA signing, then complete USB, unlock, Trust This Computer, Developer Mode, and Apple/Xcode sign-in only as human gates appear.

## 24. Mac doctor procedure

Use `scripts/doctor/mobile-agent-mac-doctor.ts` and [`scripts/doctor/README.md`](../../scripts/doctor/README.md). It requires explicit UDID and checks macOS, Xcode, signing, WDA health, pairing, MobileNext/mobilecli, screenshot, foreground, Home, tap, type, swipe, launch, and reconnect probes.

## 25. Doctor interpretation

Missing, failed, or unrun automatic checks mean `BLOCKED`. Passing them means only `READY_FOR_HUMAN_GATES`; it is not M0 pass or real-iOS verification. Do not invent a pass status.

## 26. Human gates

Handle one gate at a time: USB connection, unlocked device, Trust This Computer, Developer Mode, Apple/Xcode sign-in and signing team, then the safe-test-screen confirmation. Never infer credentials, accept security prompts automatically, or make system/network/signing changes without approval.

## 27. MA2 permitted test levels

Level 0: screenshot, foreground app, Home. Level 1: harmless Settings/Safari navigation. Level 2: launch a test app and browse/search without external action. Level 3: recover from an unexpected page, app reload, or temporary observation failure. Advance only after the prior level is stable.

## 28. Prohibited MA2 actions

Do not publish, comment, message, follow, like, pay, purchase, change profiles, alter security settings, solve CAPTCHAs, bypass platform controls, jailbreak, spoof fingerprints, or imitate human randomness.

## 29. Policy and human escalation

Policy is evaluated before every action and lease/fencing is revalidated at execution. A required human intervention must produce `NEEDS_HUMAN` with concrete evidence; it does not bypass policy or resume work automatically.

## 30. Lease lifecycle requirement

Before any long wait or human gate, decide and document either safe lease renewal or safe release/reacquire. On reacquire, rebuild the entire ExecutionContext and revalidate Registry/Policy; never resume with a stale fencing token.

## 31. Evidence requirements

For each run preserve the bound ExecutionContext, UDID/device mapping, observation references, normalized proposals/actions, policy decisions, lease/fencing validations, backend results, verification, timing, model/token metrics if available, WDA/reconnect events, and terminal result. Evidence must be digestible and must exclude secrets and hidden reasoning.

## 32. Failure and stop conditions

Stop immediately on a device/account/network/context mismatch, missing/expired/stale lease, policy denial, WDA instability, device disconnect, incomplete Evidence, unexpected external side effect, unapproved human gate, or backend path that bypasses FleetDeviceAdapter. Record the stop and do not scale or retry blindly.

## 33. Capacity and scaling rule

MA2 is one phone only. MA3=2, MA4=4, MA5=6, MA6=9 are separate gates. At each future level measure success, wrong-device actions, failures/recovery, latency, steps, calls/tokens, CPU/RAM/GPU/API throughput, USB errors, Hatchet queue delay, and Evidence completeness. Any instability stops scaling.

## 34. OSS and patch decision rule

New complex components need `docs/oss/0000-evaluation-template.md`. No self-built workflow or Flow Engine is authorized. Preserve `NO LONG-TERM FORK`: if Mobile-Agent needs a maintained patch, isolate it against the exact SHA, test upgrades, document it, and seek upstream contribution where suitable.

## 35. Ops Brain isolation

This repository must remain entirely independent of Ops Brain. Do not access, copy, import, reference, configure, connect to, or depend on its source, customers, runtime, state, or infrastructure.

## 36. Documentation and state updates

Before MA2, update only non-secret state in `docs/handoff/ma2-state.json` if the revision or authorization changes. During/after MA2, create a dated POC report with environment/version evidence, exact pass/fail scope, stops, and unresolved findings. Do not overwrite historical MA1 evidence.

## 37. Recommended work sequence

1. Owner approves MA2 scope and dedicated device/account/network.
2. Clean clone, install locked dependencies, run `corepack pnpm verify`.
3. Record prerequisite versions; run the explicit-UDID doctor.
4. Complete human gates one at a time.
5. Implement/test only the thin `MobileNextDeviceBackend` path through FleetDeviceAdapter.
6. Run Level 0 then progress only when evidence is complete.
7. Stop and report rather than expanding scope on any guardrail failure.

## 38. Completion criteria for MA2

MA2 may be reported only if one explicit device completes approved harmless levels through the governed path, verification and Evidence are complete, wrong-device and stale-context checks fail closed, WDA/reconnect behavior is documented, and every limitation remains explicit. This still would not prove production readiness or multi-device capacity.

## 39. Useful commands

```powershell
git status --short
git rev-parse HEAD
corepack pnpm install --frozen-lockfile
corepack pnpm verify
corepack pnpm real-ios:e2e   # intentionally blocked before M0+
```

Do not run a live device command until the Mac-specific backend and owner-approved MA2 procedure exist.

## 40. Handoff conclusion

The repository is ready for a remote agent to reproduce MA1 and prepare MA2 safely. The correct next action is owner-reviewed, explicit-UDID Mac readiness work—not autonomous real-device execution, model activation, multi-device scaling, or production deployment.
