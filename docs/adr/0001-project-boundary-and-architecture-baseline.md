# ADR 0001: Project Boundary and Architecture Baseline

- Status: Accepted
- Date: 2026-09-04
- Baseline reference: `docs/architecture/IPHONE_FLEET_AGENT_ARCHITECTURE_v0.1.md` §0, §28, §32

## Context

iPhone Fleet Agent 必须先作为独立项目完成生产成熟度验证。项目需要一个唯一、可定位的架构真源和源代码工作区。

## Decision

`E:\iphone-fleet-agent` 是唯一 canonical source workspace。`docs/architecture/IPHONE_FLEET_AGENT_ARCHITECTURE_v0.1.md` 是唯一 Architecture Baseline。项目与 Ops Brain 完全隔离。

## Scope

适用于源码、配置、依赖、运行时、客户状态、基础设施引用和后续集成边界。

## Non-goals

本 ADR 不定义未来与 Ops Brain 的集成协议，也不建立任何连接、依赖或同步机制。

## OSS Evaluation

不适用；这是项目治理边界，不是组件选型。

## Consequences

任何未来跨项目集成只能在 Fleet 独立验证完成后，以显式 MCP / Job API 决策重新提出。

## Risks

重复的 Baseline 文件会造成决策漂移。

## Validation Gate

A0：同名 Architecture Baseline 仅存在一份，且位于 `docs/architecture/`；不存在 Ops Brain 的源码、运行时或依赖引用。

## Rollback/Revisit trigger

只有在独立生产验证完成后，才可通过新的 ADR 重新评估外部集成边界。
