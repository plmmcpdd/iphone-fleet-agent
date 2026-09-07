# 本地 iPhone Fleet Agent 架构现状报告（Graphify）

> 生成日期：2026-09-07  
> 分析对象：`E:\iphone-fleet-agent`（唯一 canonical source workspace）  
> 方法：Graphify `graphifyy` 0.9.55，本地 Tree-sitter AST 提取；未调用 LLM、未上传代码。  
> 范围：仓库当前工作区代码与现有架构/POC/ADR 文档。工作区存在尚未提交的 H0 相关改动；本报告描述其当前可见状态，不构成提交或发布结论。

## 1. 结论

本项目已经完成 **Phase A Control Plane**，并通过 H0.0/H0.1 将 Fleet MCP 固化为版本化、Harness 无关的产品边界；当前处于：

```text
PHASE_A_READY_FOR_MAC_POC
```

它已经具备「确定性群控控制面」的本地实现与无设备验证闭环：严格上下文、设备租约与 fencing、策略授权、验证后取证、PostgreSQL 持久化、Hatchet 工作流可行性、OpenAdapt 无设备可行性、OTel 与 Fleet MCP stdio 契约。

它**尚不是可操作真实 iPhone 的群控系统**：当前 MCP runtime 明确为 `mock`，尚未安装或验证 Mobile MCP、Mobilewright、WDA/Mobile Next、真实 iPhone、macOS Device Lab，也未选择或验证 Reference Harness。下一授权阶段是 **M0+ macOS 真机 POC**，不是直接进入生产。

## 2. Graphify 分析结果

Graphify 只对 92 个可解析代码文件进行了本地 AST 提取；Markdown 等 40 个非代码文件不参与 AST 关系图，但已被本报告作为架构证据人工交叉核对。

| 指标 | 结果 |
| --- | ---: |
| 图节点 | 712 |
| 图关系 | 1,170 |
| 社区/子系统 | 50 |
| 显式关系 | 98% |
| 推断关系 | 2%（22 条，平均置信度 0.8） |
| 检出的 import cycle | 0 |
| 分析时的代码提交 | `a11d0e7c` |

Graphify 的主要 hub 排名为：`ExecutionContext`（39 条边）、`DeviceRecord`（22）、`FleetControlPlane`（20）、`DeviceId`（20）、`JobId`（19）、`FleetError`（16）、`DeviceLeaseStore`（15）、`DeviceAction`（14）与 `EvidenceRecord`（14）。这与架构意图一致：系统以受治理的执行上下文为中心，而不是以 Harness、LLM 或某个设备驱动为中心。

完整的 Graphify 原始输出位于本机已忽略目录：`.runtime/graphify-analysis/graphify-out/`，包括 `graph.json`、`graph.html` 与 `GRAPH_REPORT.md`。

## 3. 当前实现的总体结构

```text
外部 Harness / Agent（尚未选择）
             │ 标准 MCP stdio（H0.1，v0.1）
             ▼
      apps/fleet-mcp
             │ 7 个 Fleet 工具；runtime=mock
             ▼
 packages/control-plane ────────► packages/application
 FleetControlPlane                 Ports + fail-closed authorization
             │                             │
             │                             ├── DeviceBackend（当前 mock）
             │                             ├── DeviceLeaseStore
             │                             ├── EvidenceSink
             │                             ├── RegistryReader
             │                             └── WorkflowEngine（仅预留，未接线）
             ▼
 packages/domain / contracts / state-machines
 IDs、ExecutionContext、Policy、实体、错误、XState 生命周期
             │
     ┌───────┼───────────────────┬───────────────────┐
     ▼       ▼                   ▼                   ▼
 In-memory  PostgreSQL       Evidence/OTel       Hatchet workflow spike
 mock A2    A3 durable       A5 audit trace      A4 durable orchestration
             │
             └── 未来 macOS Device Node（M0+）
                   Mobile MCP / Mobilewright / WDA / Mobile Next
                   OpenAdapt MobileNextBackend（待真机验证）
                   真实 iPhone
```

### 3.1 边界与职责

| 层 | 当前状态 | 职责与限制 |
| --- | --- | --- |
| Domain / Contracts | 已实现 | 定义九字段 `ExecutionContext`、ID、实体、错误、策略与设备动作；不依赖 MCP、Hatchet、OpenAdapt、Mobile MCP 或 Mobilewright 私有类型。 |
| Application | 已实现 | 通过 ports 执行设备授权：上下文、设备/账号/网络匹配、生命周期、租约、fencing、策略均 fail-closed。 |
| Control Plane | 已实现（mock runtime） | `FleetControlPlane` 编排提交、租约、设备动作、后置验证、Evidence 与终态；成功必须经过验证和 Evidence。 |
| MCP 产品边界 | 已实现（H0） | 标准 stdio、MCP Contract v0.1、固定 7 工具、结构化成功/错误信封；不泄露内部 PostgreSQL/Hatchet/DeviceBackend 细节。 |
| Registry 与 Lease | 已实现并完成 A3 验证 | PostgreSQL 是 Registry 与 production/durable Lease 真源；内存实现只用于 mock/单进程测试。 |
| Job / Worker 编排 | 已完成 A4 薄胶水验证 | Hatchet 负责重试、按设备并发、worker routing、durable wait；Control Plane → Hatchet port 仍未接线。 |
| Evidence / Telemetry | 已实现并完成 A5 验证 | 原子落盘、SHA-256 完整性校验、包含完整执行上下文的 OTel spans；Langfuse 尚未接入。 |
| Flow | 仅 A6 可行性验证 | OpenAdapt Flow 证明了合成像素 backend 的 record → compile → replay → report；不是已验证的 iOS Flow runtime。 |
| 真机 Phone Operator | 未开始 | Mobile MCP/Mobilewright/WDA/Mobile Next 与真实 iPhone 仅为选定方向，尚未安装或集成。 |

## 4. 一次受治理的执行路径

当前 Control Plane 的 mock 垂直切片实现了以下顺序，关键原则是「**不允许 LLM 或单一动作结果成为成功真源**」。

```text
fleet_submit_job
  → 精确 client/account/device/network 查询
  → acquire Device Lease（含 TTL + fencing token）
  → 构造九字段 ExecutionContext
  → authorizeDeviceAction（fail-closed）
  → device health
  → execute DeviceBackend action
  → independent verification / postcondition
  → append Evidence + OTel span
  → SUCCEEDED
  → finally: release Lease

任一失败 → FAILED + failure Evidence；
需要人工处理 → NEEDS_HUMAN + Evidence，恢复由 Hatchet durable event 模型承接。
```

九字段上下文为：`jobId`、`clientId`、`accountId`、`deviceId`、`networkAssignmentId`、`leaseId`、`fencingToken`、`actorId`、`correlationId`。其贯穿授权、设备调用、取证和 tracing，正是 Graphify 中连接度最高的抽象。

## 5. Fleet MCP v0.1：当前对外能力

H0 的 Fleet MCP 是稳定产品边界，当前为本地 stdio、`runtime: "mock"`：

| 工具 | 用途 |
| --- | --- |
| `fleet_status` | 查询 runtime、设备与任务计数。 |
| `fleet_list_devices` | 列出设备及明确的 client/account/network 绑定。 |
| `fleet_find_device` | 仅当三项绑定完全匹配时返回设备，绝不替代猜测设备。 |
| `fleet_submit_job` | 提交含完整上下文的治理任务；当前只允许 mock `set_state`。 |
| `fleet_get_job` | 获取终态、上下文与稳定错误码。 |
| `fleet_get_evidence` | 获取按时间排序的审计 Evidence；空数组不代表成功。 |
| `fleet_request_human` | 标记 `NEEDS_HUMAN` 并记录需要的人类干预，不绕过策略。 |

每次写入提交都必须显式提供业务和审计上下文；lease/fencing 是不透明审计字段，Harness 不能伪造或借此绕过 Fleet。MCP 调用完成不等于作业成功，只有 `job.state = SUCCEEDED` 且存在匹配 Evidence 才可报告成功。

## 6. 已完成的 Gate 证据

项目严格遵循 `A0 → A1 → A2 → A3 → A4 → A5 → A6 → H0 → M0+`。当前状态如下：

| Gate | 状态 | 已验证结论 |
| --- | --- | --- |
| A0 | 通过 | 项目边界、OSS-first 和开发拓扑已固定。 |
| A1 | 通过 | Domain、Ports、九字段上下文、三套 XState 生命周期、fail-closed 授权。 |
| A2 | 通过 | mock 垂直切片和 7 个 MCP 工具草案；覆盖错设备/账号/网络、过期/陈旧租约、验证/Evidence/释放失败。 |
| A3 | 通过 | PostgreSQL Registry/Lease；并发 acquire 仅一方成功、fencing 和重启持久性已测。 |
| A4 | 通过 | 官方 Hatchet Embedded 验证了 per-device 并发 1、跨设备并发 2、重试、worker labels 与 durable resume。 |
| A5 | 通过 | 本地 Evidence SHA-256 校验、OTel、Harness 边界与 Agent Skill 结构验证。 |
| A6 | 通过（仅 no-device feasibility） | OpenAdapt 公开 API 的合成 backend 跑通，但结果为 `COMPLETED_UNVERIFIED`、`production_eligible=false`。 |
| H0.0/H0.1 | 通过 | Fleet MCP Contract v0.1 的 stdio 黑盒、契约和 mock 安全提交/取证往返验证。 |
| M0+ | 未开始 | 真机设备链、Mobile MCP/Mobilewright、WDA、Mac node 和真实效果验证。 |

## 7. 当前设计的关键优点

- **Harness 可替换**：MCP 是长期边界，Harness 的 session、memory、UI、Router 与内部工具类型不得进入 domain/control-plane。
- **并发安全优先**：真实设备按 `deviceId` 串行；Lease 以 TTL 和 fencing token 防止过期操作者继续写入。
- **业务状态确定性**：设备/账号/网络由 PostgreSQL 与 XState 管理；Job 生命周期由 Hatchet 管理，避免双状态机。
- **成功可审计**：动作、后置验证、Evidence 和 digest 是必经链路，错误也会写 Evidence。
- **OSS-first 落地**：Hatchet、PostgreSQL、XState、OTel、OpenAdapt 等各自只承担明确职责，未重写调度器、Flow Engine、iOS driver 或 Agent Framework。
- **开发环境隔离正确**：Windows Native 为控制面主环境，WSL 只用于 A3/A4/A6，macOS 仅从 M0+ 承担 Apple 设备链。

## 8. 风险、缺口与不应误读的结论

| 风险/缺口 | 当前事实 | M0+ 的处理方向 |
| --- | --- | --- |
| 真实 iOS | 完全未验证；mock 成功不等于 iPhone E2E。 | 在 macOS Device Lab 从只读 health/screenshot proof 开始。 |
| Apple 设备链 | 未确认 Xcode signing、Developer Mode、pairing、WDA、隧道与重启恢复。 | 固定 UDID、专用测试机/账号/网络，逐项记录版本、许可证和证据。 |
| Phone Operator | Mobile MCP/Mobilewright 还不是依赖或实现。 | 先完成 OSS Evaluation，再用显式 lease/context 进行最小真机验证。 |
| OpenAdapt | 没有 native `mobile` target；当前只是 synthetic custom backend。 | 只允许上游/附加 adapter 路径；若验证失败，重新 OSS Evaluation，禁止直接自研 Flow Engine。 |
| Production 编排 | Hatchet workflow 已验证但尚未 wired 到生产 Control Plane。 | 以薄 Adapter 连接；Hatchet 继续独占 Job/workflow lifecycle。 |
| Reference Harness | H0 仅评估候选，没有安装、选择或完成 C1–C9。 | 经单独授权后，用共享 compatibility contract 做实测选择。 |
| 生产治理 | 隐私脱敏、生产 policy profiles、独立业务效果验证未资格化。 | 保持 Human Gate；真机阶段不得执行外部可见或不可逆操作。 |
| 部署 | Embedded Hatchet 仅是本地验证拓扑。 | 另行设计并验证多节点部署，不把本地 spike 当生产容量结论。 |

## 9. 推荐的下一步（不越过 Gate）

1. 维持 H0 已冻结的 Fleet MCP v0.1 边界，不把 Harness 或真机驱动类型渗透至 domain/control-plane。
2. 准备 macOS Device Lab，并按 `docs/poc/mac-m0-handoff.md` 完成 Xcode/WDA/配对/专用测试资源检查。
3. 在引入 Mobile MCP、Mobilewright 或 Mobile Next 之前，新增相应 OSS Evaluation（版本、License、维护性、iOS 支持与 Adapter 边界）。
4. M0 的首个真机作业仅做带完整 context/lease/fencing 的只读 health/screenshot；完成验证、Evidence 和人工 Gate 后，才讨论后续写操作。
5. 真机链稳定后，再将已有 Hatchet workflow 通过预留 `WorkflowEngine` thin adapter 接入；不要建设自研队列、调度器或 Flow Engine。

## 10. 证据与可追溯性

- 架构真源：[IPHONE_FLEET_AGENT_ARCHITECTURE_v0.1.md](IPHONE_FLEET_AGENT_ARCHITECTURE_v0.1.md)
- Phase A 总结：[`../poc/phase-a-final-report.md`](../poc/phase-a-final-report.md)
- H0 产品化：[`../poc/gate-h0-mcp-productization.md`](../poc/gate-h0-mcp-productization.md)
- MCP 契约：[`../mcp/fleet-mcp-v0.1.md`](../mcp/fleet-mcp-v0.1.md)
- M0+ Mac 接手：[`../poc/mac-m0-handoff.md`](../poc/mac-m0-handoff.md)
- 框架职责 ADR：[`../adr/0004-framework-responsibility-boundaries.md`](../adr/0004-framework-responsibility-boundaries.md)
- MCP-first ADR：[`../adr/0005-mcp-first-and-reference-harness.md`](../adr/0005-mcp-first-and-reference-harness.md)
- Graphify 项目与用法：[Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify)

> 本报告没有访问、导入、修改或依赖 Ops Brain 的源码、客户状态、运行时、配置或基础设施。
