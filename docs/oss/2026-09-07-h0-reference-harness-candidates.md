# OSS Evaluation: H0 Reference Harness candidates

- Status: Evaluated; installation and selection deferred
- Date: 2026-09-07
- Related ADR: `docs/adr/0005-mcp-first-and-reference-harness.md`

## Candidate

DeepSeek Harness and MiMo Code only.

## Official repository

- DeepSeek Harness: https://github.com/deepseek-ai/deepseek-harness
- MiMo Code: https://github.com/XiaomiMiMo/MiMo-Code

## License

Both repositories publish source under MIT. MiMo Code also publishes use restrictions and separate terms for Xiaomi-hosted services; those service terms must be reviewed if that provider is selected.

## Activity

Both repositories were active when checked. DeepSeek Harness explicitly labels itself developer preview with compatibility-breaking changes expected. MiMo Code publishes signed releases; v0.1.13 was the latest observed release, dated 2026-08-19. Neither is declared the Reference Harness before C1–C9 testing.

## API / SDK

DeepSeek Harness supplies an official `@deepseek-ai/dsh-mcp-client` plugin. It discovers stdio tools before the first turn, exposes stable server-qualified names, propagates MCP `isError`, and supports Web and one-shot headless profiles. Its official Web UI runs locally; Fleet does not embed or fork it. It has a filesystem Skill provider and repository `AGENTS.md` conventions.

MiMo Code supports local stdio MCP entries under the `mcp` JSON/JSONC key, an interactive TUI, `mimo run` headless tasks, project configuration under `.mimocode/`, Agent Skills, and project instructions. An upstream open issue reported that configured MCP servers were not initialized by `mimo serve` in v0.1.5; therefore server/attach mode is not an H0 assumption and must be retested on the chosen version.

## Self-host requirement

Both are local Harness runtimes and require a selected model/provider for real Agent calls. H0 creates no hosted service, account, key, or cloud resource.

## Platform requirements

DeepSeek Harness runs from its Node package and documents local Web/headless modes; macOS compatibility must be exercised on the Device Lab before selection. MiMo Code officially publishes macOS arm64/x64 release assets and npm installation for all platforms. Both need access to the built Fleet MCP Node entry point and its canonical repository path.

## Overlap

Both candidates provide Agent session/tool loops and user interaction. Fleet must not adopt their memory, orchestration, UI, Router, or internal tool types as Control Plane responsibilities. Hatchet remains workflow owner; Fleet MCP remains the only Harness capability boundary.

## Adapter feasibility

No Adapter Framework is needed. Each candidate can spawn the same local stdio command using a thin configuration entry. DeepSeek renames model-visible tools with a server namespace; this presentation detail must not change raw Fleet tool names. MiMo uses its own config layout; this difference stays in the profile example.

## Reasons for adoption/rejection

Both proceed to a later, explicitly approved compatibility run. DeepSeek has the clearest first-party MCP bridge and a local Web experience for non-technical operators, but its developer-preview status is a stability risk. MiMo Code has direct cross-platform binaries, TUI/headless operation, Skills, and project config, but MCP behavior in server mode has a documented open uncertainty. Selection requires measured C1–C9 results and deployment UX; H0 makes no recommendation winner.

## Validation evidence

Official repository README, MCP/CLI/Skills documentation, release pages, and the shared `docs/harness/compatibility-contract.md`. No candidate was installed or executed in H0.
