# ADR 0003: OSS First Gate

- Status: Accepted
- Date: 2026-09-04
- Baseline reference: `docs/architecture/IPHONE_FLEET_AGENT_ARCHITECTURE_v0.1.md` §1.1, §3.5, §32.5

## Context

Fleet Agent 的职责是 Integration Engineering。复杂通用能力应优先采用成熟 OSS，并通过薄 Adapter 隔离差异。

## Decision

任何超过薄 Adapter 或业务规则复杂度的新组件，必须先记录 OSS Evaluation。只有成熟候选不适用、Adapter 不足以解决差异，并经过 ADR 决策时，才能提出自研。

若 A6 的 OpenAdapt 验证失败，必须重新执行 OSS Evaluation；不得直接自研 Flow Engine。只有所有成熟 OSS 候选均不满足需求、形成明确自研 ADR 且取得人工批准后，才允许提出实现工作。

## Scope

适用于框架、工作流引擎、设备自动化、可观测性、存储、管理 UI 和其他通用基础设施。

## Non-goals

本 ADR 不在 A0 安装、试运行或采用任何 OSS 组件。

## OSS Evaluation

- Evaluation record: `docs/oss/0000-evaluation-template.md`
- Candidate outcome: OpenAdapt 是 A6 的首选候选，但不是不可替换依赖。

## Consequences

每个新复杂组件都需要可审计的候选与拒绝理由；自研 Flow Engine 没有自动授权路径。

## Risks

成熟 OSS 的平台或 Adapter 限制可能延长 POC，但不能以此跳过评估门槛。

## Validation Gate

A0：模板和治理规则存在。A6：OpenAdapt 失败时停止实现，先完成重新评估和人工审批。

## Rollback/Revisit trigger

当候选项目的维护、License、API 或平台支持发生实质变化时，重新评估。
