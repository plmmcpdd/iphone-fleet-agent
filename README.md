# iPhone Fleet Agent

独立的 iPhone Fleet Agent 项目：以通用 Phone Operator 与确定性 Fleet Control Plane 为目标。

当前状态：Phase A Control Plane 实施中。A0～A5 已通过本地 Gate；真实 iOS 验证仍等待 M0+ 的 macOS Device Lab。

## Architecture Baseline

唯一架构真源为：[`docs/architecture/IPHONE_FLEET_AGENT_ARCHITECTURE_v0.1.md`](docs/architecture/IPHONE_FLEET_AGENT_ARCHITECTURE_v0.1.md)。

本项目与 Ops Brain 完全独立；不得访问、修改或依赖其源码、客户状态或运行时。

## 开发拓扑

- Windows Native + PowerShell 7：主开发环境；`E:\iphone-fleet-agent` 是唯一 canonical source workspace。
- WSL Ubuntu-E：仅在 A3、A4、A6 按需作为 Linux integration/runtime environment。
- macOS：iOS Device Lab；M0+ 才依赖。

Gate 顺序固定为：`A0 → A1 → A2 → A3 → A4 → A5 → A6 → M0+`。

## 验证入口

- `pnpm build` / `pnpm typecheck` / `pnpm lint`
- `pnpm unit` / `pnpm contract` / `pnpm e2e-mock`
- `pnpm integration:postgres`：Windows client + WSL user-local PostgreSQL
- `pnpm integration:hatchet`：Windows build + WSL official Hatchet Embedded
- `pnpm verify`：Windows Control Plane/mock verification
- `pnpm real-ios:e2e`：M0+ 之前固定失败，防止把 mock 结果误报为 real iOS

Mac 接手清单见 [`docs/poc/mac-m0-handoff.md`](docs/poc/mac-m0-handoff.md)。
