# iPhone Fleet Agent 技术架构与开发指导 v0.1

> 状态：Architecture Baseline / POC Guidance  
> 日期：2026-09-04  
> 目标：作为 iPhone Fleet Agent 独立项目的架构真源与后续 Codex 开发指导文件。  
> 说明：本文件优先描述“已经冻结的原则、首选开源组件、边界、POC 验收和开发方式”。在 POC 真实数据出现前，不把尚未验证的性能假设写成生产结论。

---

## 0. Executive Summary

iPhone Fleet Agent 的 North Star 不是传统“脚本群控”，也不是某个平台专用机器人，而是：

> **一个能够像人一样理解和操作真实 iPhone，同时以机器级可靠性管理和调度多台设备的通用 Fleet Agent。**

核心思想：

- **Human-level flexibility**：Agent 可以面对未预定义的新任务、新 App、新页面，Observe → Reason → Act。
- **Machine-level orchestration**：设备、账号、网络、任务、并发、审批、证据、重试必须由确定性系统管理。
- **OSS First**：复杂通用组件默认优先采用成熟开源项目；自研只保留业务模型、Policy、Adapter 和必要胶水。
- **Agent 与 Flow 共存**：
  - 未知、新颖、异常任务：由 Agent 探索。
  - 已验证、重复任务：沉淀为确定性 Flow，减少 Token、延迟与幻觉。
- **iPhone 只是执行终端**：平台不是底层能力边界。小红书只是首个验收场景；TikTok、Instagram、Shadowrocket、系统设置等都属于同一套 Phone Operator 能力范围。
- **Ops Brain 暂时保持完全独立**：Fleet 先成为独立可生产项目；成熟后再通过 MCP / Job API 接入 Ops Brain。

---

# 1. 强制架构原则

## 1.1 OSS First Gate

对于任何预计超过“小型 Adapter / 业务规则”复杂度的新组件，**不得直接自研**。

必须先完成 OSS Evaluation：

1. 搜索成熟开源候选。
2. 检查：
   - License
   - 活跃度
   - 最近维护情况
   - API / SDK 可用性
   - 是否支持自托管
   - 是否与现有栈重复
   - 是否能通过 Adapter 解决差异
3. 只有在现有开源方案确实不适用时才允许自研。
4. 自研前必须留下 ADR（Architecture Decision Record），说明：
   - 候选项目
   - 许可证
   - 活跃度
   - 功能差距
   - 为什么 Adapter 不够
   - 自研范围为什么足够小

**禁止因为“自己写好像也不难”就重新实现成熟基础设施。**

---

## 1.2 通用 Agent，不做平台专用机器人

第一条真实验证 Flow 选择小红书，是为了降低测试不确定性，而不是限定产品边界。

底层能力模型是：

```text
Device
+
Observe
+
Act
+
Reason
```

而不是：

```text
XHS API
TikTok API
Instagram API
```

因此 Agent 应能够在正常权限边界内：

- 打开任意已安装 App
- 判断当前前台 App
- 读取 Accessibility Tree
- 截图
- 点击
- 输入
- 滑动
- 返回 / Home
- 启动 / 关闭 App
- 读取页面状态
- 根据页面变化继续判断
- 跨 App 完成长任务

平台差异应主要体现在：

- Skill
- Flow
- Policy
- Business Workflow

而不是底层设备驱动。

---

## 1.3 Flow 是优化，不是能力前提

Agent 不应被限制为“只能调用预定义 Flow”。

正确模型：

```text
UNKNOWN TASK
    ↓
Agent Exploration
    ↓
成功
    ↓
Trace / Evidence
    ↓
判断是否值得复用
    ↓
Skill / Flow Candidate
    ↓
Validation
    ↓
ACTIVE FLOW
```

成熟后：

```text
重复任务
→ 已有 Flow
→ 确定性执行
→ 不需要 LLM 每一步重新思考
```

因此：

- Agent 解决未知任务与异常。
- Flow 解决稳定重复任务。
- Flow 不等于平台能力边界。
- Flow 不应成为“脚本群控”的重新包装。

---

## 1.4 Agent Memory ≠ Chat History

严禁把长任务做成无限增长的 ReAct 对话。

完整历史应落在外部状态中：

- Job state
- Artifact
- Action trace
- Screenshot
- UI snapshot
- Evidence
- Event log
- Flow run report

模型工作上下文只保留：

- 总目标
- 当前 Subtask
- 当前 Device / Account / Network
- 当前 UI state
- 最近少量动作
- 与当前任务相关的 Artifact
- 相关经验
- 当前权限边界

长任务通过：

```text
Goal
↓
Planner
↓
Subtask A
↓
Artifact A
↓
Subtask B
↓
Artifact B
...
```

而不是让模型背着几十屏历史继续操作。

---

## 1.5 基础设施状态不能依赖 LLM 记忆

LLM 可以推理，但不能成为设备和业务状态的真源。

这些必须是确定性系统状态：

- 哪台手机在线
- 哪台手机被谁占用
- 哪个账号绑定哪台手机
- 当前 Network Assignment
- 当前 Job
- 当前 Device Lease
- Account 生命周期
- Device 生命周期
- Approval 状态
- Error 状态

模型说“我刚才应该已经发完了”不能作为成功依据。

必须通过 UI / Artifact / Postcondition / External Evidence 验证。

---

# 2. 项目边界

## 2.1 独立项目

新建独立项目：

```text
iphone-fleet-agent/
```

必须与 Ops Brain：

- 独立 Repo
- 独立 Runtime
- 独立 State
- 独立 DB
- 独立 Release
- 独立 MCP

当前不得为了 Fleet POC 修改成熟的 Ops Brain。

未来：

```text
Ops Brain
    │
    │ MCP / Job API
    ▼
iPhone Fleet Agent
    │
    ▼
iPhone Fleet
```

Ops Brain 未来只发送高层业务意图，例如：

```text
为 ADA 的三个 READY 小红书账号发布 CONTENT-9281
```

Ops Brain 不应该知道：

- UDID
- WDA port
- USB port
- Xcode build
- DeviceKit
- mobilecli
- 点击坐标
- Shadowrocket 页面细节

---

# 3. 首选 OSS 技术栈

## 3.1 Agent Harness

### 首选 POC 候选

- DeepSeek Harness
- Claude Code（A/B 对照）
- Codex（开发 / 调试 / MCP fallback）

原则：

> Fleet 的业务代码不得写死在某一个 Harness 里。

统一通过：

```text
MCP
+
CLI
```

暴露能力。

因此上层可以替换：

```text
DeepSeek Harness
Claude Code
Codex
其他 MCP-compatible Harness
```

而无需重写设备基础设施。

---

## 3.2 Phone Operator：Mobile MCP

Repo：

- https://github.com/mobile-next/mobile-mcp

定位：

> 通用 Agent 操作真实手机的原子工具层。

首选理由：

- 支持 MCP
- 支持真实 iOS
- 支持 iOS Simulator / Android
- Accessibility-first
- Screenshot / Coordinate fallback
- 明确支持 Agent / LLM
- 可指定具体 device
- 可用于 Claude Code、Codex 等 MCP Client

正常模式下，Agent 应通过 Fleet 高层接口行动。

只有以下状态才暴露较多原子手机能力：

- Exploration
- Recovery
- Diagnostics

---

## 3.3 Deterministic Mobile Execution：Mobilewright

Repo：

- https://github.com/mobile-next/mobilewright

定位：

> 已验证 Flow 的确定性手机执行层。

关键能力：

- Playwright 风格
- `getByRole`
- `getByLabel`
- `getByText`
- auto-wait
- retry assertions
- real device
- accessibility tree
- 指定 deviceId
- remote mobilecli
- TypeScript

原则：

- 优先 semantic locator。
- 不优先坐标。
- 不使用随机点击、随机滑动、随机 sleep 模拟人类。
- 等待真实元素状态，而不是盲目固定延时。

---

## 3.4 Device Runtime：mobilecli / iOS Device Stack

Mobilewright / Mobile MCP 下层使用 Mobile Next 的设备能力。

当前真实 iOS 仍需要 Apple 开发链：

- macOS
- Xcode
- Developer Mode
- WebDriverAgent / Device Kit 路径
- go-ios / tunnel（按具体版本与 Mobile Next 路线）
- 真实设备签名

业务代码不得直接绑定：

- 特定 WDA port
- 特定 xcodebuild 命令
- go-ios 私有调用方式

必须保留：

```text
DeviceBackend
```

抽象。

---

## 3.5 Record → Compile → Replay：OpenAdapt Flow

Repo：

- https://github.com/OpenAdaptAI/openadapt-flow

定位：

> 把成功演示 / Agent 探索轨迹编译成可复用确定性工作流。

优先验证：

```text
Mobile MCP / Agent
↓
成功探索
↓
Trace
↓
OpenAdapt Flow
↓
Compile
↓
Replay
↓
Heal / Verify
```

目标是尽量不要自己开发：

- Trace Recorder
- Flow DSL
- Flow Compiler
- Replay Engine
- Healing Engine
- Workflow IR
- Postcondition Engine

建议新增：

```text
MobileNextBackend
```

作为 OpenAdapt 与 Mobilewright/mobilecli 的薄 Adapter。

在 POC 未验证前，不把 OpenAdapt 写成不可替换依赖；但它是当前首选。

---

## 3.6 Experience / Self-Evolution：MobiAgent 等作为研究与评估对象

重点参考：

- https://github.com/IPADS-SAI/MobiAgent
- X-PLUG Mobile-Agent-E
- AppAgentX

MobiAgent 可重点参考：

- Planner
- Multi-task
- Artifact
- Experience Memory
- Action Memory / AgentRR
- 历史经验检索

但 v0.1 不直接把完整 MobiAgent Runtime 接进 Fleet：

原因：

- 当前执行层主要围绕 Android / Harmony
- 与 DeepSeek Harness、Mobile MCP、Mobilewright、OpenAdapt 有明显重叠
- 容易形成“双 Planner / 双 Grounder / 双 Runtime”

原则：

> 借鉴 / 拆用成熟模块可以；不要为了“用了开源”而把多个重复 Agent Runtime 全部堆在一起。

---

# 4. Orchestration：Hatchet

Repo：

- https://github.com/hatchet-dev/hatchet

定位：

> Fleet 的 Job / Scheduler / Worker / Durable Workflow 中枢。

优先采用 Hatchet，Temporal 作为 fallback。

Hatchet 负责：

- Job Queue
- Retry
- Scheduled Job
- Durable Task
- DAG
- Event Wait
- Worker Routing
- Worker Affinity
- Worker Labels
- Worker Slots
- Priority
- Rate Limit
- Dynamic Concurrency
- Execution History
- Logs
- Web UI
- OpenTelemetry

示例：

```text
MAC-CN-001
labels:
  node=MAC-CN-001
  region=CN

worker slots:
  4
```

真实稳定并发在 POC 中测出后再写入 Capacity。

---

# 5. Device Lease 与并发

## 5.1 Production Flow

Hatchet 动态 concurrency key 优先承担：

```text
device:IPHONE-CN-003
limit = 1
```

保证同一真实 iPhone 同时只执行一个生产 UI Job。

---

## 5.2 Exploration / Recovery

交互式 Agent 可能连续控制手机几分钟，需要单独的薄 Lease：

```text
device_id
lease_id
owner
expires_at
fencing_token
created_at
```

要求：

- TTL
- 自动过期
- fencing token
- 所有原子手机操作必须携带有效 lease
- 不允许两个 Agent 同时持有同一设备

这是必要自研的“小型基础设施”，不应扩展成自研分布式调度平台。

---

# 6. Registry：PostgreSQL + XState

## 6.1 为什么不强行用 NetBox / Snipe-IT

NetBox 擅长网络 / DCIM / IPAM。

Snipe-IT 擅长 IT Asset Management。

但 Fleet 的核心对象是：

```text
Client
Account
Device
Network
Assignment
Node
Job Relation
```

尤其包含：

- Platform account lifecycle
- Client ownership
- Account ↔ Device assignment
- Account ↔ Network assignment
- Challenge / Session state
- Current business use

这些不是 NetBox / Snipe-IT 的主要领域。

因此：

> Registry Schema 自定义，但数据库和状态机不自研。

---

## 6.2 PostgreSQL

正式 Control Plane 推荐：

```text
PostgreSQL
```

而不是再单独维护 SQLite。

原因：

- Hatchet 本身以 PostgreSQL 为 durability layer。
- 多 Node / 多 Worker 后更适合集中状态。
- 避免 Hatchet 用 PostgreSQL、Fleet Registry 又用 SQLite 的双存储复杂度。

建议逻辑隔离：

```text
PostgreSQL instance
├ hatchet DB/schema
└ fleet DB/schema
```

---

## 6.3 XState

Repo：

- https://github.com/statelyai/xstate

负责：

- Device lifecycle
- Account lifecycle
- Network lifecycle

不负责 Job lifecycle。

规则：

```text
Domain Lifecycle
→ XState

Job / Workflow Lifecycle
→ Hatchet
```

---

# 7. Domain Model

## 7.1 Device

示例：

```text
IPHONE-CN-001
```

字段建议：

- id
- udid
- serial
- model
- ios_version
- node_id
- status
- battery
- storage
- last_seen
- current_account
- current_network
- current_job
- created_at
- updated_at

Device lifecycle：

```text
DISCOVERED
↓
ENROLLING
↓
READY
↓
BUSY
```

异常：

```text
DEGRADED
NEEDS_HUMAN
OFFLINE
RETIRED
```

---

## 7.2 Account

账号不等于设备。

示例：

```text
ACCOUNT-XHS-ADA-01
```

字段：

- client_id
- platform
- handle / alias
- assigned_device_id
- assigned_network_id
- state
- recent_jobs
- error_count
- last_success_at
- policy

生命周期：

```text
PROCUREMENT_PENDING
↓
ACQUIRED
↓
DEVICE_ASSIGNED
↓
LOGIN_PENDING
↓
PROFILE_SETUP
↓
WARMUP
↓
READY
↓
ACTIVE
```

异常：

```text
SESSION_EXPIRED
CHALLENGE
RESTRICTED
DEGRADED
NEEDS_HUMAN
RETIRED
```

账号采购：

> 必须人工确认。

登录 / 2FA / Challenge：

> 默认 Human Gate。

---

## 7.3 Network

当前实际网络链路：

```text
iPhone
↓
Shadowrocket
↓
VLESS
↓
Alibaba Cloud HK
↓
IPRoyal ISP
↓
Internet
```

Fleet v0.1 不重写此网络系统。

Network Registry 只负责：

- expected provider
- expected egress
- expected region
- health
- assignment
- current state
- last check

自动允许：

- 检查出口
- 检查连通性
- 发现异常
- 暂停任务
- 记录 Evidence

默认不自动：

- 随意换 IP
- 随意换 VLESS Profile
- 跨账号重新绑定线路
- 自动重做整套 Network Assignment

这些需 Policy / Approval。

---

# 8. Universal Phone Operator

Fleet Agent 必须拥有两类能力。

## 8.1 Fleet Control

回答：

> “应该操作哪台手机？”

例如：

```text
fleet_status
fleet_list_devices
fleet_find_device
fleet_get_account
fleet_check_network
fleet_submit_job
fleet_get_job
fleet_get_evidence
fleet_request_human
```

---

## 8.2 Phone Operator

回答：

> “拿到这台手机后，下一步怎么操作？”

例如：

```text
phone.observe
phone.screenshot
phone.list_elements
phone.open_app
phone.tap
phone.type
phone.swipe
phone.back
phone.home
phone.get_state
```

v0.1 可直接复用 Mobile MCP 原子工具，不急着全部包成自有 phone.* 命名。

关键原则：

> 接口负责抽象复杂性，不负责限制 Agent 智能。

Agent 可以完成新任务，但不能绕过：

- Device Lease
- Account Policy
- Human Gate
- Client boundary
- Audit
- Network health
- Permission boundary

---

# 9. 长任务与上下文治理

## 9.1 禁止无限 ReAct

不允许：

```text
Screenshot
→ Think
→ Tap
→ Screenshot
→ Think
→ Tap
...
```

把整个历史反复塞进同一个上下文。

---

## 9.2 Hierarchical Execution

长任务必须支持：

```text
Goal
↓
Planner
↓
Subtask 1
↓
Artifact 1
↓
Subtask 2
↓
Artifact 2
...
```

每个 Subtask 只读取必要状态。

---

## 9.3 Context Pack

当前模型工作集建议只包含：

```text
Goal
Current Subtask
Device
Account
Network
Current App
Current UI
Recent Actions
Relevant Artifacts
Relevant Experience
Policy / Allowed Actions
```

最近动作保留少量窗口，例如 3–8 步作为默认方向，具体数值由 POC 测试。

完整历史保存外部。

---

## 9.4 Harness Compaction

优先使用 Harness 自带：

- Session
- Compaction
- Persistent Log
- Subagent / Workflow（若有）

不要自己先写 Context Compression Framework。

---

# 10. 学习机制

## 10.1 生命周期

```text
UNKNOWN TASK
↓
Agent Exploration
↓
SUCCESS
↓
Trace + Evidence
↓
Reusable?
↓ YES
Skill Candidate
↓
Compile / Generalize
↓
Validation
↓
ACTIVE
```

---

## 10.2 三层能力模型

### Level 1 — Universal Phone Operator

- 未定义的新任务
- 新页面
- 临时操作
- 跨 App

Agent Observe → Reason → Act。

### Level 2 — Reusable Skill / Flow

例如：

- 小红书发布内容
- TikTok 发布视频
- IG 发布帖子
- 收集评论
- 查看账号状态
- 网络检查

### Level 3 — Business Workflow

例如：

- 矩阵运营
- 截流
- Lead 筛选
- 评论管理
- 私信
- 内容生产
- ROI 复盘
- Boost 建议

这些由多个 Skill / Flow + AI 判断 + Approval 组合。

---

# 11. Agent Skills

开放标准：

- https://github.com/agentskills/agentskills
- https://github.com/vercel-labs/skills

Skill 采用：

```text
skill/
├ SKILL.md
├ scripts/
├ references/
└ assets/
```

优势：

- Progressive Disclosure
- 按需加载
- Git versioning
- 跨 Harness 可移植
- 不需要自研 Skill Registry Server

建议：

```text
fleet-skills.git
│
├ xhs/
├ tiktok/
├ instagram/
└ system/
```

Agent Skill 负责：

- 什么时候做
- 为什么做
- 业务约束
- 输入输出
- 风险
- Recovery 规则

OpenAdapt Flow / Mobilewright 负责：

- 手机上实际怎么执行

---

# 12. Human Handoff

v0.1 不开发复杂远程直播墙。

触发：

- LOGIN_REQUIRED
- 2FA
- CHALLENGE
- UNKNOWN_SECURITY_DIALOG
- 账号采购
- 高风险外发
- Spend / Boost
- 关键 profile 修改
- 跨客户 reassignment

状态：

```text
NEEDS_HUMAN
```

Hatchet durable event wait：

```text
Job
↓
NEEDS_HUMAN
↓
Suspend
↓
Human resolves
↓
HUMAN_RESOLVED event
↓
Resume
```

POC：

```text
fleetctl resolve JOB-123
```

即可。

未来 Approval UI：

优先评估 Appsmith，而不是从零开发 React Admin。

Repo：

- https://github.com/appsmithorg/appsmith

---

# 13. Evidence / Observability

## 13.1 Flow Evidence

OpenAdapt：

- report.json
- before/after screenshots
- heal event
- step result
- postcondition

---

## 13.2 Job Evidence

Hatchet：

- workflow history
- task execution
- errors
- timing
- worker
- retry
- logs

---

## 13.3 Agent Evidence

Langfuse：

- https://github.com/langfuse/langfuse

可用于：

- LLM call
- token
- latency
- tool action
- Agent trace
- A/B DeepSeek Harness vs Claude Code
- recovery analysis

---

## 13.4 标准 Telemetry

OpenTelemetry：

- https://github.com/open-telemetry/opentelemetry-js

作为标准 instrumentation 层。

原则：

```text
App / Fleet / Worker
↓
OpenTelemetry
↓
Langfuse / Grafana / Jaeger / other
```

不要把业务代码锁死在某一个观测平台。

---

## 13.5 Screenshot / Video

POC：

```text
local filesystem
```

生产扩大后：

```text
S3 / SeaweedFS
```

SeaweedFS：

- https://github.com/seaweedfs/seaweedfs

不要在 POC 期先部署对象存储集群。

---

# 14. Windows / Mac 开发边界

## 14.1 结论

> **大约 80%–90% 的系统可以在 Windows + WSL2 上开发；但真实 iPhone 的 Apple 设备链必须在 macOS 上开发和验证。**

Mac 不是 AI 主机，而是：

> **iOS Device Node / Apple Toolchain Host**

---

## 14.2 Windows / WSL2 可以开发的内容

以下可以主要在 Windows / WSL2 完成：

### Control Plane

- Fleet MCP
- Fleet API
- Fleet CLI
- Registry Schema
- PostgreSQL integration
- XState machines
- Hatchet workflow definitions
- Scheduler policy
- Account / Device / Network business logic
- Approval policy
- Device Lease business logic
- Job model
- Evidence metadata
- OpenTelemetry
- Langfuse integration
- Agent Skills
- DeepSeek Harness integration
- Claude Code A/B harness
- Vision provider adapter
- OSS adapters that do not require Apple Framework
- Unit tests
- Contract tests
- Mock device tests
- Simulator-independent architecture tests

可以在 Windows 主力电脑继续使用：

```text
Windows
↓
WSL2
↓
pnpm / Node / TypeScript
↓
Fleet Control Plane
```

---

## 14.3 必须在 Mac 上开发 / 验证的内容

只要涉及**真实 iPhone Apple 自动化链**，必须有 macOS：

### Apple Toolchain

- Xcode
- Developer signing
- Developer Mode
- WebDriverAgent
- XCUITest-related setup
- iOS tunnel
- go-ios（若当前 Mobile Next 实现需要）
- Device Kit（若 Mobile Next 后续采用）
- iOS Simulator
- 真 iPhone pairing

### 真实 iPhone E2E

- Mobile MCP → Real iPhone
- Mobilewright → Real iPhone
- mobilecli → Real iPhone
- Device discovery
- UDID selection
- 多 iPhone 并发
- USB Hub 稳定性
- Mac Worker
- Node heartbeat against physical phones
- iPhone screenshot / accessibility
- XHS / TikTok / Instagram 实际 App 自动化

### OpenAdapt 的 MobileNextBackend 真机验证

Adapter 接口本身可以在 Windows 写。

但：

```text
OpenAdapt
→ MobileNextBackend
→ Mobilewright
→ Real iPhone
```

最终 integration / E2E 必须在 Mac。

---

## 14.4 Windows-first 开发策略

正确方式不是：

```text
等 Mac 到了
↓
所有开发才开始
```

而是：

```text
Windows
↓
先开发并测试 80% Control Plane
↓
Mock / Contract Test
↓
Mac 到手
↓
只验证 Apple-specific Adapter + E2E
```

具体：

```text
Windows
├ Domain
├ Registry
├ XState
├ Hatchet Workflow
├ Fleet MCP
├ Policy
├ Evidence Metadata
├ Skill
├ OpenAdapt Adapter interface
└ Mock DeviceBackend

Mac
├ Mobile MCP
├ Mobilewright
├ mobilecli
├ Xcode / WDA
├ Real DeviceBackend
└ E2E Tests
```

这样 Mac 租赁的一周不会浪费在开发普通 CRUD / Schema / Queue 上。

---

# 15. 推荐 Repo 结构

```text
iphone-fleet-agent/
│
├ apps/
│  ├ fleet-mcp/
│  ├ fleet-api/
│  ├ fleetctl/
│  └ fleet-node/
│
├ packages/
│  ├ domain/
│  ├ registry/
│  ├ state-machines/
│  ├ policy/
│  ├ device-lease/
│  ├ evidence/
│  ├ telemetry/
│  ├ vision/
│  ├ mobilenext-adapter/
│  └ openadapt-adapter/
│
├ workflows/
│  └ hatchet/
│
├ skills/
│  └ ...
│
├ flows/
│  └ ...
│
├ tests/
│  ├ unit/
│  ├ contract/
│  ├ integration/
│  └ e2e-macos/
│
├ docs/
│  ├ ADR/
│  └ ...
│
└ scripts/
```

---

# 16. Mac Device Node

Mac 不承担主推理。

职责：

```text
Mac Device Node
│
├ Xcode
├ Mobile MCP
├ Mobilewright
├ mobilecli
├ iOS runtime
├ fleet-node worker
├ local evidence cache
└ Hatchet worker
```

硬件第一阶段：

```text
M1
16GB RAM
256GB SSD
```

足够做 POC。

以后正式采购：

- 16GB = 合格
- 24GB = 更有余量，不是硬要求
- 256GB 可接受
- 外置 SSD 可承载日志、截图、录屏、历史 Evidence
- 不建议用多个机械盘承载活跃工作负载

物理矩阵：

```text
Mac
├ Powered USB Hub A → 4~5 iPhones
└ Powered USB Hub B → 4~5 iPhones
```

---

# 17. 9 台 SE2 并发原则

9 台在线 ≠ 9 台并发 Session。

POC 必须逐级测试：

```text
1
↓
2
↓
4
↓
6
↓
9
```

记录：

- Session 成功率
- WDA / DeviceKit 稳定性
- CPU
- RAM
- USB 掉线
- 执行延迟
- Appium/MobileNext error
- 单机故障是否影响其他设备

例如最终测得：

```text
9 online
stable concurrency = 4
```

则生产 Node：

```text
worker slots = 4
```

其余任务排队。

不能在没有测试数据时假设 M1 可以稳定 9 并发。

---

# 18. 第一条真实 POC：小红书

小红书只是第一个验收平台。

推荐任务：

```text
打开小红书
↓
进入指定业务页面
↓
填写测试内容
↓
到发布前一步 / 保存草稿
↓
验证状态
```

避免一开始大量公开发布。

目标验证的是：

```text
Agent
→ Real iPhone
→ Observe
→ Act
→ Verify
→ Trace
→ Compile
→ Replay
```

不是测运营效果。

---

# 19. 一周 M1 POC Gates

## Gate 0 — Apple 环境

- macOS 正常
- 无 MDM 限制
- Xcode 安装
- iPhone 配对
- Developer Mode
- 签名链成立

PASS 条件：

> 真实 SE2 可被正常开发工具识别。

---

## Gate 1 — 1 台 iPhone / Mobile MCP

验证：

- device discovery
- screenshot
- accessibility tree
- launch app
- tap
- type
- swipe
- foreground app

PASS：

> Agent 可稳定操作真实 SE2。

---

## Gate 2 — 真实 App

优先 XHS。

验证：

- 页面 Accessibility 可读比例
- 结构化 locator 成功率
- 哪些页面需要截图/Vision fallback
- App 自定义 UI 是否影响控制

---

## Gate 3 — Agent 长任务

让 Agent 完成一个 15–30 步左右的真实操作任务。

记录：

- token
- tool call 数量
- context growth
- wrong action
- recovery
- completion rate

验证 Context / Artifact 设计。

---

## Gate 4 — Agent → Trace → OpenAdapt

完成：

```text
成功 Agent Trace
↓
OpenAdapt compile
↓
Replay
```

PASS：

> 同一台设备不依赖 LLM 可以再次完成。

---

## Gate 5 — 第二台 SE2

验证：

- device_id 强绑定
- 不串机
- 独立 session
- Device Lease
- Hatchet concurrency key

要求：

> 串机次数 = 0。

---

## Gate 6 — 多机

测试：

```text
2 → 4 → 6 → 9
```

得出真实 Node Capacity。

---

## Gate 7 — Failure Injection

主动制造：

- App 页面不同
- App 被退出
- 元素不存在
- Network unhealthy
- device offline

验证：

```text
Flow fail
↓
NEEDS_AGENT / RETRY / HUMAN
```

不能无休止继续乱点。

---

## Gate 8 — Human Handoff

制造：

```text
LOGIN_REQUIRED / CHALLENGE
```

验证：

```text
Hatchet suspend
↓
Human resolves
↓
event
↓
resume
```

---

## Gate 9 — Harness A/B

同一任务：

```text
DeepSeek Harness
vs
Claude Code + DeepSeek
```

比较：

- Tool success
- completion
- context
- token
- latency
- recovery
- wrong-device
- session stability

---

# 20. POC Go / No-Go 指标

至少记录：

| 指标 | 目标 |
|---|---:|
| 9 台设备识别 | 9/9 |
| 错误串机 | 0 |
| 单机成熟 Flow 重复成功率 | ≥95% 作为初始目标 |
| 2 台并发错误串机 | 0 |
| 一台掉线影响其他设备 | 不影响 |
| Job Evidence 完整 | 100% |
| 错误状态能停止 | 100% |
| NEEDS_HUMAN 能正确暂停 | 必须 |
| Network 异常能阻断任务 | 必须 |
| Flow 可版本回滚 | 必须 |
| Agent → Replay 技术链 | 必须跑通 |

这些目标在 POC 结束后根据实测修订，不把初始目标伪装成已验证指标。

---

# 21. 权限等级

## L0 — 自动

- health
- status
- screenshot
- network check
- data collection
- verification

## L1 — 自动 + Audit

- 已审批内容
- 成熟 Flow
- 数据采集
- 正常导航

## L2 — Human Gate

- 新 Flow 上生产
- 首次高风险外发
- 关键 profile 修改
- Network reassignment
- cross-client reassignment

## L3 — Human

- procurement
- login
- 2FA
- challenge
- identity verification
- spend / boosting
- 其他法律/平台要求人工的动作

---

# 22. 明确禁止项

系统核心不得设计为：

- jailbreak
- hardware fingerprint spoofing
- anti-abuse evasion
- captcha bypass
- 模拟随机“手抖”
- 随机点击
- 随机滑动
- 随机等待来“像真人”
- 无业务目的的自动养号浏览
- 无边界的自动换 IP
- 绕过平台安全验证

业务层允许：

- 每账号不同任务窗口
- 每账号日预算
- 最小任务间隔
- staggered scheduling
- 账号状态差异
- workload balancing

目的：

> 业务稳定和资源管理，而不是规避平台检测。

---

# 23. Security

- DeepSeek / LLM API Key 只存 Control Plane。
- Mac Node 不必持有主 Agent API Key。
- Apple signing key 只在 Mac Keychain。
- 账号密码原则上不进 Fleet DB。
- `.env` 不进 Git。
- Fleet MCP / Mobile MCP 只开放私网或受认证网络。
- 每个工具调用记录 device / lease / job。
- 用户输入和 App 屏幕文字视为不可信数据。
- 不把 App 页面上的 prompt-like 文本自动保存为 Agent 指令。
- 证据中注意账号、客户数据最小化。
- 生产前增加 client isolation tests。

---

# 24. 不开发清单

v0.1 默认**不自研**：

- Chat UI
- Agent Framework
- Harness
- iOS Driver
- WebDriverAgent
- Accessibility Parser
- Mobile Automation Framework
- Flow DSL
- Flow Compiler
- Workflow Engine
- Scheduler
- Queue
- LLM Observability Platform
- Skill Registry Server
- Approval Dashboard
- Object Storage
- VPN
- Vision Model
- Remote Device Video Wall

优先现成组件。

---

# 25. 真正允许自研的核心

Codex 的主要任务应当是 Integration Engineering。

主要自研范围：

```text
Fleet Domain Model
Fleet MCP
Fleet Business Policy
Registry Schema
Device / Account / Network Assignment
Interactive Device Lease
MobileNext ↔ OpenAdapt Adapter
Hatchet Workflow glue
Evidence metadata glue
Approval rules
Client isolation
OSS adapter layer
```

原则：

> 自研代码越靠近“锦荣自己的业务规则”越合理；越靠近“通用基础设施”越应该优先找 OSS。

---

# 26. Windows-first 开发阶段

## Phase A — Windows / WSL2

先完成：

1. repo scaffold
2. TypeScript / pnpm
3. PostgreSQL
4. Hatchet dev
5. domain schema
6. XState
7. Fleet MCP
8. Policy
9. Interactive Lease
10. Mock DeviceBackend
11. OpenAdapt Adapter interface
12. Agent Skills
13. OTel
14. contract tests

不需要等 Mac。

---

## Phase B — Mac Integration

租 M1 后：

1. Xcode
2. iPhone pairing
3. Mobile MCP
4. Mobilewright
5. mobilecli
6. real DeviceBackend
7. XHS test
8. OpenAdapt E2E
9. multi-device
10. Node capacity
11. failure recovery

---

## Phase C — Productionization

POC 通过后：

- 购买正式 Mac mini
- 9 台接入
- Hatchet Worker
- Production Postgres
- Evidence retention
- Appsmith Approval UI（如需要）
- Langfuse
- SeaweedFS/S3（如需要）
- Ops Brain MCP / Job API（最后）

---

# 27. 架构总图

```text
                           USER
                             │
                             ▼
           DeepSeek Harness / Claude Code
                             │
                       DeepSeek V4 Pro
                             │
                             ▼
                         Fleet MCP
                    【薄自研业务边界】
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
          ▼                  ▼                  ▼
      Registry            Hatchet           Agent Skills
 PostgreSQL + XState     Orchestrator       Private Git
          │                  │
          │              Job / Schedule
          │              Retry / Priority
          │              Routing / Slots
          │              Concurrency
          │              Event Wait
          │                  │
          └──────────────────┼──────────────────┘
                             ▼
                        Mac Device Node
                             │
                     fleet-node worker
                             │
             ┌───────────────┴───────────────┐
             │                               │
             ▼                               ▼
       Production Mode                Exploration / Recovery
             │                               │
       OpenAdapt Flow                    Mobile MCP
             │                               │
       MobileNextBackend                    │
             │                               │
        Mobilewright ────────────────────────┘
             │
         mobilecli
             │
      iOS Device Stack
             │
      ┌──────┼──────┬────── ... ──────┐
      ▼      ▼      ▼                  ▼
   SE2-01  SE2-02  SE2-03           SE2-09
      │      │      │                  │
 Shadowrocket / Assigned Network / Business Egress
```

旁路：

```text
NEEDS_VISUAL
→ Vision Provider
→ DeepSeek Vision / Doubao / Other
```

```text
NEEDS_HUMAN
→ Hatchet Durable Wait
→ Human
→ Resume Event
```

```text
Telemetry
→ OpenTelemetry
→ Langfuse / Grafana / other
```

---

# 28. 当前冻结结论

以下作为 v0.1 Architecture Baseline：

1. Fleet Agent 独立于 Ops Brain。
2. Fleet Agent 是通用 Phone Operator，不是小红书机器人。
3. 小红书是首个验收场景，不是能力边界。
4. Agent 可以执行未知任务。
5. Flow 是重复任务的优化，不是 Agent 能力前提。
6. OSS First 为强制架构原则。
7. DeepSeek Harness 与 Claude Code 做 A/B，Fleet 不绑定 Harness。
8. Mobile MCP 为 Agent 手机原子操作主候选。
9. Mobilewright 为确定性手机执行主候选。
10. OpenAdapt Flow 为 Record / Compile / Replay / Heal 主候选。
11. MobiAgent 等用于经验学习设计参考和可拆组件评估，不直接占据主 Runtime。
12. Hatchet 为 Job / Scheduler / Worker / Durable Workflow 首选。
13. Temporal 为 Orchestrator fallback。
14. PostgreSQL 为 Control Plane 关系型数据基础。
15. XState 管 Device / Account / Network 生命周期。
16. Hatchet 管 Job 生命周期。
17. Production Job 并发优先交给 Hatchet。
18. Exploration/Recovery 保留薄 Interactive Device Lease。
19. Agent Skills + Git 作为 Skill 管理标准。
20. OpenTelemetry 做通用 telemetry。
21. Langfuse 做 Agent / LLM Observability 候选。
22. Appsmith 作为未来 Approval UI 候选。
23. Screenshot / Video POC 先本地，规模化后再考虑 SeaweedFS/S3。
24. Windows / WSL2 承担大部分 Control Plane 开发。
25. macOS 专门承担 Apple Toolchain、真实 iPhone integration、E2E。
26. 真实 iOS 验证不能被 Windows 完全替代。
27. M1 16GB + 256GB 足够一周 POC。
28. 9 台在线不等于 9 台并发；并发必须实测。
29. 不做 jailbreak、fingerprint spoofing、captcha bypass、随机“拟人化”操作。
30. Ops Brain 只有在 Fleet 独立生产验证完成后才接入。

---

# 29. 仍需通过 POC 决定的事项

以下暂不冻结：

1. DeepSeek Harness vs Claude Code 哪个做 Fleet 默认 Harness。
2. OpenAdapt Flow + MobileNextBackend 是否足够稳定。
3. Mobile MCP 在 XHS / TikTok / Instagram 的 Accessibility 覆盖率。
4. Vision fallback 的最佳供应商。
5. M1 对 2 / 4 / 6 / 9 并发的真实稳定上限。
6. Mobile Next 未来 Device Kit 与当前 WDA/go-ios 路径迁移影响。
7. Hatchet 在实际 Device concurrency / worker affinity 场景的最终配置。
8. 是否需要长期引入 Langfuse。
9. 何时需要 Appsmith。
10. 何时需要 S3 / SeaweedFS。
11. Experience Memory 最终采用 MobiAgent 结构、Agent Skills、简单 RAG，还是组合方案。
12. 是否需要独立 Vision Eval。
13. 何时接入 Ops Brain。

---

# 30. Codex 后续开发纪律

Codex 实施前必须：

1. 阅读本文件。
2. 不修改 Ops Brain。
3. 不默认新增 Framework。
4. 新复杂组件先做 OSS Evaluation。
5. 使用 Adapter 隔离第三方项目。
6. 所有第三方依赖 Pin 版本。
7. 保存 LICENSE 与 NOTICE 要求。
8. 对关键依赖增加 health / doctor command。
9. 所有设备操作必须有 explicit device id。
10. 所有生产原子操作必须受 Device Lease / concurrency 保护。
11. 所有高风险动作必须走 Policy。
12. 所有 Job 必须产出 Evidence。
13. 所有状态机 transition 必须显式。
14. 所有 Mac-specific 代码必须与 Control Plane 分层。
15. Windows 单元测试不能假装等于真实 iPhone E2E。
16. POC 测试结果与架构假设分开记录。
17. 不为了“看起来完整”提前开发 Dashboard、对象存储、远程直播墙。
18. 优先让系统“真实控制一台 iPhone、学习一次、无 LLM Replay、再扩到多台”。

---

# 31. 最优先技术证明

整个项目的第一性目标不是“把系统页面做出来”，而是证明：

```text
User Goal
↓
General Agent
↓
Mobile MCP
↓
Real iPhone
↓
成功完成未知任务
↓
Trace
↓
OpenAdapt Compile
↓
Deterministic Replay
↓
第二次不依赖 Agent
↓
扩展到第二台 iPhone
↓
0 串机
```

只要这条链真实跑通，后续 Fleet Registry、Scheduler、Policy、Approval、Metrics 都属于可工程化问题。

如果这条链跑不通，应优先替换底层组件，而不是继续堆上层产品功能。

---

# 32. A0 Governance Amendments

以下条目由 Gate A0 批准，作为本 Architecture Baseline 的补充；除本节明确内容外，不改变既有冻结结论。

## 32.1 Gate 顺序

开发 Gate 必须严格按以下顺序推进：

```text
A0 → A1 → A2 → A3 → A4 → A5 → A6 → H0 → M0+
```

任何 Gate 未通过或未完成审核前，不得开始后续 Gate。

## 32.2 开发拓扑

```text
Windows Native + PowerShell 7
→ 主开发环境
→ E:\iphone-fleet-agent 为唯一 canonical source workspace

WSL Ubuntu-E
→ 按需 Linux integration/runtime environment
→ 仅 A3、A4、A6 可按需使用

macOS
→ iOS Device Lab
→ M0+ 才依赖
```

A0～A2 必须能够完全在 Windows Native 完成。A5 继续使用 Windows Native；真实 iPhone 验证不得由 Windows 测试替代。

## 32.3 A1 ExecutionContext 预留字段

A1 的 ExecutionContext 设计必须包含以下字段：

```text
jobId
clientId
accountId
deviceId
networkAssignmentId
leaseId
fencingToken
actorId
correlationId
```

本 Gate 只记录该约束，不实现接口或业务逻辑。

## 32.4 MCP Contract 状态

第 8.1 节中的 Fleet MCP 工具集合状态为：

```text
Fleet MCP Contract v0.1
```

H0.1 在 A2 验证完成后将 draft 产品化为版本化 v0.1 契约；未来变更必须按兼容性规则演进。

## 32.5 OpenAdapt A6 失败规则

若 A6 的 OpenAdapt 验证失败，禁止直接自研 Flow Engine。必须重新执行 OSS Evaluation；只有成熟 OSS 候选均无法满足需求、且已形成自研 ADR 并获得人工批准后，才可提出自研实现。

## 32.6 H0 MCP-first 产品边界

Fleet MCP 是长期稳定产品边界，Harness 是外部宿主。Fleet 不自研聊天 UI、Agent Framework、模型 Router 或 Harness Router。可以选择并推荐一个效果最佳的 Reference Harness，其他 Harness 作为 compatibility target；任何 Harness 差异不得进入 domain/control-plane，且产品层推荐不得改变 Fleet MCP 的标准接口。H0 首轮候选仅限 DeepSeek Harness 与 MiMo Code；此前候选清单不构成本轮安装或评测授权。
