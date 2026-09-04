# ADR 0004: Framework Responsibility Boundaries

- Status: Accepted
- Date: 2026-09-04
- Baseline reference: `docs/architecture/IPHONE_FLEET_AGENT_ARCHITECTURE_v0.1.md` §3, §8, §9, §10, §32.3, §32.4

## Context

多个 OSS 候选在 Agent、设备操作、Flow、Job、状态和 telemetry 层存在相邻职责。必须在引入前固定边界，避免重复实现和双重编排。

## Decision

Harness 负责 Agent session/tool loop；Mobile MCP 负责探索与恢复中的手机原子操作；Mobilewright 负责确定性设备操作；OpenAdapt Flow 是 Record/Compile/Replay/Heal 候选；Hatchet 负责 durable Job/Scheduler/Worker；XState 负责 Device/Account/Network 生命周期；OpenTelemetry 是通用 telemetry 层。

Fleet MCP 工具集合状态固定为 `MCP Contract v0.1-draft`，A2/M1 前不视为长期冻结 API。

A1 的 ExecutionContext 必须预留：`jobId`、`clientId`、`accountId`、`deviceId`、`networkAssignmentId`、`leaseId`、`fencingToken`、`actorId`、`correlationId`。A0 只记录约束，不创建接口或实现。

## Scope

适用于未来 Adapter、Control Plane 端口和第三方组件集成。

## Non-goals

本 ADR 不添加任何运行时依赖，不实现 MCP、DeviceBackend、Job、Lease、状态机或 Flow。

## OSS Evaluation

- Evaluation record: `docs/oss/0000-evaluation-template.md`
- Candidate outcome: 具体采纳版本和 POC 结论由后续组件级评估记录决定。

## Consequences

后续实现必须通过 Adapter 保持框架边界，且不得将 draft MCP Contract 视为外部稳定承诺。

## Risks

组件 API、成熟度和平台支持仍需在对应 POC Gate 验证。

## Validation Gate

A0：职责边界、draft 状态和 ExecutionContext 字段已记录。A1/A2：开始接口与 mock 验证前必须遵守这些约束。

## Rollback/Revisit trigger

当 POC 证明职责边界不成立，或 MCP Contract 在 A2/M1 后需要稳定化时，通过新 ADR 修订。
