# iPhone Fleet Agent

独立的 iPhone Fleet Agent 项目：以通用 Phone Operator 与确定性 Fleet Control Plane 为目标。

当前状态：Gate A0 — Governance Bootstrap。A1 尚未开始。

## Architecture Baseline

唯一架构真源为：[`docs/architecture/IPHONE_FLEET_AGENT_ARCHITECTURE_v0.1.md`](docs/architecture/IPHONE_FLEET_AGENT_ARCHITECTURE_v0.1.md)。

本项目与 Ops Brain 完全独立；不得访问、修改或依赖其源码、客户状态或运行时。

## 开发拓扑

- Windows Native + PowerShell 7：主开发环境；`E:\iphone-fleet-agent` 是唯一 canonical source workspace。
- WSL Ubuntu-E：仅在 A3、A4、A6 按需作为 Linux integration/runtime environment。
- macOS：iOS Device Lab；M0+ 才依赖。

Gate 顺序固定为：`A0 → A1 → A2 → A3 → A4 → A5 → A6 → M0+`。

## A0 边界

本 Gate 只建立项目治理、ADR/OSS Evaluation 模板和无依赖的 Node/pnpm/TypeScript 配置基线。不创建应用、API、数据库、Dashboard 或业务包；不安装依赖。
