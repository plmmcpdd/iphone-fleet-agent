# Agent Instructions

1. 开始任何开发前，先阅读 `docs/architecture/IPHONE_FLEET_AGENT_ARCHITECTURE_v0.1.md`。
2. `E:\iphone-fleet-agent` 是本项目唯一 canonical source workspace。
3. 本项目与 Ops Brain 完全独立。不得访问、修改、复制、导入、链接或依赖 Ops Brain 的源码、客户状态、运行时、配置或基础设施。
4. Gate 必须严格按 `A0 → A1 → A2 → A3 → A4 → A5 → A6 → H0 → M0+` 顺序执行。未通过审核前不得进入下一 Gate。
5. 对超过薄 Adapter 或业务规则复杂度的新组件，先完成 `docs/oss/0000-evaluation-template.md` 所定义的 OSS Evaluation；不得重复实现成熟通用框架。
6. Windows Native + PowerShell 7 为主开发环境。A0～A2 只在 Windows Native 完成；A3、A4、A6 才可按需使用 WSL Ubuntu-E；M0+ 才依赖 macOS iOS Device Lab。
7. Fleet MCP 是稳定产品边界；H0.1 起对外协议为版本化的 `Fleet MCP Contract v0.1`。Harness 差异不得进入 domain/control-plane。
8. A6 的 OpenAdapt 验证失败时，必须重新完成 OSS Evaluation。未获得人工批准的自研 ADR 前，禁止自研 Flow Engine。
9. 所有第三方依赖必须明确 pin 版本并满足相应 License/NOTICE 要求。
