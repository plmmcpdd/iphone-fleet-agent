# ADR 0002: Development Topology

- Status: Accepted
- Date: 2026-09-04
- Baseline reference: `docs/architecture/IPHONE_FLEET_AGENT_ARCHITECTURE_v0.1.md` §14, §26, §32.1, §32.2

## Context

Control Plane 需要在 Windows-first 环境中推进，但真实 iPhone 自动化链依赖 Apple 工具链，不能被 Windows 测试替代。

## Decision

Windows Native + PowerShell 7 是主开发环境；WSL Ubuntu-E 是按需 Linux integration/runtime environment；macOS 是 iOS Device Lab。A0～A2 必须完全在 Windows Native 完成；仅 A3、A4、A6 可按需使用 WSL；M0+ 才依赖 macOS。

## Scope

适用于 Gate 环境选择、验证表述和源代码工作区位置。

## Non-goals

本 ADR 不安装、配置或变更 Windows、WSL、PowerShell、macOS、网络或设备。

## OSS Evaluation

不适用；这是环境职责划分，不是组件选型。

## Consequences

每个 POC 记录必须标明实际执行环境；Windows 单元或 mock 测试不能声称为真实 iPhone E2E。

## Risks

macOS Device Lab 可用性会影响 M0+ 的实际设备验证节奏。

## Validation Gate

A0：治理文档中的环境矩阵与 Baseline 一致。后续每个 Gate 依据本 ADR 选择环境。

## Rollback/Revisit trigger

只有在平台能力或 Device Lab 形态发生实质变化时，才通过新 ADR 修订。
