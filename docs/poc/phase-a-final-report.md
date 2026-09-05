# Phase A Final Report

- Date: 2026-09-05
- Canonical workspace: `E:\iphone-fleet-agent`
- Conclusion: `PHASE_A_READY_FOR_MAC_POC`
- Real iOS status: not tested; M0+ requires a macOS Device Lab and real iPhone

## 1. Gate Matrix

| Gate | Result | Principal evidence |
| --- | --- | --- |
| A1 Domain & Ports | PASS | Nine-field context, fail-closed authorization, three XState domain lifecycles, port contracts |
| A2 Mock Vertical Slice | PASS | Seven Fleet MCP draft tools and complete mock execution/evidence lifecycle |
| A3 PostgreSQL Registry & Lease | PASS | Six real PostgreSQL transaction/concurrency/restart tests |
| A4 Hatchet Orchestration | PASS | Official embedded engine retry, per-device concurrency, worker routing and durable restart recovery |
| A5 Auditability / Harness-neutral | PASS | Persistent SHA-256 Evidence, OTel spans, Agent Skill and harness boundary contracts |
| A6 OpenAdapt Feasibility | PASS | Public Backend → Recorder → Compiler → Replayer → report, without fork or core patches |

## 2. Gate Evidence

### A1

- Implemented strict `ExecutionContext`, domain records/errors/policy, application ports and XState v5 Device/Account/Network machines.
- Tests reject missing lease, stale fencing, mismatched client/account/device/network, wrong explicit device and invalid transitions.
- Hatchet/OpenAdapt/MCP/Mobilewright private types do not enter domain/contracts. No Job XState machine exists.

### A2

- Implemented mock DeviceBackend, Registry, LeaseStore, Evidence, Control Plane, fleetctl and seven MCP v0.1-draft tools.
- Exercised submit → resolve → lease → action → verify → evidence → terminal → release.
- Injected wrong device/account/network, stale and expired lease, offline device, verification failure, Evidence failure and Lease release failure.
- Fixed an early-return/finally bug so a release failure cannot leave a successful result.

### A3

- Implemented node-pg-migrate schema, Registry repository and transactional Lease repository over PostgreSQL 16.15.
- Two simultaneous acquires for one device yield exactly one success; stale tokens were rejected 20/20; new Pool instances retain Registry/Lease state.
- Fixed the non-system PostgreSQL socket path and made expiry checks use database time.

### A4

- Implemented only Hatchet workflow/worker glue: reserve → action → verify → evidence → success.
- Official engine measured same-device maximum concurrency 1 and cross-device concurrency 2; retry attempts were 0 then 1.
- Worker labels and four normal/durable slots were asserted. A durable human wait was evicted from worker 1 and resumed on worker 2.
- Fixed the test's premature worker-stop race by waiting for durable-wait registration; no scheduler or workflow engine was copied.

### A5

- Local Evidence uses atomically published directories, persistent JSON metadata/artifacts and SHA-256 verification on read.
- OTel integration captures action, verification and Evidence spans with all nine context attributes; error spans rethrow the underlying failure.
- Tampered artifacts, unsafe IDs and caller-forged digests fail closed.
- Fleet MCP transport smoke and static harness boundary contracts pass. `skills/fleet-control/SKILL.md` passes structural validation.
- Fixed async context narrowing and an unanchored ignore rule that initially hid `packages/evidence`.

### A6

- Installed `openadapt-flow==1.35.0` only in a WSL Python 3.12 isolated venv.
- Synthetic 320×568 mobile state recorded one action, compiled one step, replayed one action on the template rung, passed 2/2 postconditions and emitted JSON/Markdown/screenshots with digests.
- The complete Fleet context remains at the adapter boundary; zero model calls and no replay network calls occurred.
- Outcome remains `COMPLETED_UNVERIFIED` and `production_eligible=false` because there is no independent business-effect verifier.
- No fork, monkey patch, DSL/compiler/replayer change or custom Flow Engine was needed.

## 3. Dependency Manifest

Direct external dependencies and runtime components:

| Package/component | Exact version | License | Owning layer / reason |
| --- | --- | --- | --- |
| Node.js | 24.14.1 | MIT | Windows project toolchain |
| pnpm | 11.19.0 | MIT | Workspace/package manager |
| TypeScript | 7.0.2 | Apache-2.0 | Compile/typecheck |
| `@types/node` | 26.4.1 | MIT | Node typings |
| Biome | 2.5.12 | MIT/Apache-2.0 | Formatter/linter |
| Vitest | 5.0.0 | MIT | Unit/contract/integration/mock E2E tests |
| tsx | 4.23.13 | MIT | TypeScript CLI/dev execution |
| Zod | 4.5.4 | MIT | Strict external contracts |
| XState | 5.32.6 | MIT | Device/Account/Network lifecycle only |
| MCP TypeScript SDK | 1.30.0 | MIT | Fleet MCP transport/server |
| PostgreSQL | 16.15 | PostgreSQL | Registry and Lease truth |
| pg | 8.23.0 | MIT | PostgreSQL adapter |
| `@types/pg` | 8.23.1 | MIT | PostgreSQL typings |
| node-pg-migrate | 9.0.0 | MIT | Schema migration ledger |
| Hatchet TypeScript SDK | 1.31.0 | MIT | Workflow/worker integration |
| Hatchet Embedded | v0.105.16 | MIT | Local orchestration engine; Linux binary SHA-256 pinned |
| OpenTelemetry API | 1.9.1 | Apache-2.0 | Vendor-neutral production spans |
| OpenTelemetry SDK trace base | 2.11.0 | Apache-2.0 | In-memory integration proof only |
| OpenAdapt Flow | 1.35.0 | MIT | A6 record/compile/replay/report candidate |
| pip | 26.2.1 | MIT | Isolated A6 installer |

All Node transitive resolutions are fixed by `pnpm-lock.yaml`. All 29 A6 Python distributions are fixed by `spikes/openadapt/requirements.lock.txt`; only OpenAdapt Flow is a direct A6 requirement.

## 4. Authored Project Tree

```text
.
├── apps/
│   ├── fleet-mcp/{src,test,package.json,tsconfig.json}
│   └── fleetctl/{src,test,package.json,tsconfig.json}
├── docs/
│   ├── adr/{0000-template,0001..0004,README}.md
│   ├── architecture/IPHONE_FLEET_AGENT_ARCHITECTURE_v0.1.md
│   ├── oss/{0000-template,A1..A6 evaluations,README}.md
│   └── poc/{A1..A6 Gate reports,mac-m0-handoff,phase-a-final-report,README}.md
├── packages/
│   ├── application/{src,test}
│   ├── contracts/{src,test}
│   ├── control-plane/{src,test}
│   ├── domain/src
│   ├── evidence/{src,test}
│   ├── inmemory/{src,test}
│   ├── observability/{src,test}
│   ├── postgres/{migrations,src,test}
│   └── state-machines/{src,test}
├── scripts/
│   ├── windows/{test-postgres,test-hatchet,test-openadapt}.ps1
│   └── wsl/{local-postgres,setup-openadapt}.sh
├── skills/fleet-control/SKILL.md
├── spikes/openadapt/{a6_spike.py,requirements.txt,requirements.lock.txt}
├── tests/harness-boundary.contract.test.ts
├── workflows/hatchet/{src,package.json,tsconfig.json}
├── AGENTS.md
├── README.md
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
└── TypeScript, Biome and Vitest configuration files
```

Generated `dist`, `node_modules`, `.runtime`, Evidence output and Python caches are ignored.

## 5. Git

- Branch: `main`.
- Seven local Gate/checkpoint commits exist from A0 through A6, plus this final report checkpoint.
- Remote: none.
- Tags: none.
- No push, release or GitHub operation occurred.
- The pre-existing untracked `新建文本文档.txt` remains untouched and excluded from every commit.

## 6. Test Summary

- Build: PASS, 12 authored workspace projects.
- Typecheck: PASS.
- Lint: PASS, 82 files at the final A6 run.
- Unit: 5 PASS.
- Contract: 17 PASS.
- Local integration: 6 PASS.
- E2E mock: 7 PASS.
- PostgreSQL WSL integration: 6 PASS.
- Hatchet WSL integration: PASS with retry/concurrency/restart assertions.
- OpenAdapt WSL integration: PASS with record/compile/replay/report assertions.
- `pnpm verify`: PASS for all Windows + WSL Phase A checks.
- `pnpm real-ios:e2e`: intentionally blocked until M0+.

## 7. OSS Boundary Check

No Agent Framework, Scheduler, Workflow Engine, Flow Engine, iOS Device Driver, WDA, Skill Registry, observability platform, Dashboard framework, object store or vision model was reimplemented. Fleet code is limited to domain safety rules, application coordination and thin OSS adapters.

## 8. Ops Brain Isolation

No source import, package dependency, runtime call, customer state or filesystem path references Ops Brain. Textual mentions exist only in governance/baseline documents to state the isolation rule.

## 9. Security / Fail-closed Check

- Every device action carries explicit `deviceId` and the complete ExecutionContext.
- Context, lease and fencing mismatch reject execution.
- Evidence is mandatory before success and artifact tampering is rejected.
- Harness packages cannot depend directly on PostgreSQL, LeaseStore, DeviceBackend or Hatchet.
- LLM output is never a Device/Account/Network/Job/Lease state truth.
- No credentials, cloud resources, public content, network changes or bypass mechanisms were used.

## 10. Known Unknowns

- No Mac, WDA, Mobile MCP, Mobilewright or real iPhone has been tested.
- OpenAdapt 1.35.0 lacks a native `mobile` execution-target kind; the public custom backend works only as an unbound demo surface in A6.
- Real Retina screenshot/coordinate normalization, accessibility identity, iOS permission prompts and WDA restart behavior remain unknown.
- Real-device independent effect verification, privacy scrubbing and production policy profiles remain unqualified.
- Embedded Hatchet is a local validation topology, not the final multi-node deployment design.

## 11. Mac M0 Handoff

Follow `docs/poc/mac-m0-handoff.md`: install Xcode, configure signing, enable Developer Mode, pair the device, validate WDA/current Mobile Next iOS stack, evaluate Mobile MCP/Mobilewright, use explicit UDID and test accounts/network, configure Evidence, and preserve a human gate. Begin with a read-only health/screenshot proof carrying Device/Lease/fencing context.

## 12. Actual Status

`PHASE_A_READY_FOR_MAC_POC`

This means the Control Plane and no-device integrations are ready for the next POC. It does not mean production ready or real iOS verified.
