# ADR 0005: MCP-first and Reference Harness

- Status: Accepted
- Date: 2026-09-07
- Baseline reference: `docs/architecture/IPHONE_FLEET_AGENT_ARCHITECTURE_v0.1.md` §3.1, §8.1, §32.4, §32.6

## Context

Fleet needs a durable product boundary while Agent hosts continue to change. Requiring identical behavior from every Harness would hide meaningful differences in model tool use and deployment experience; embedding those differences in Fleet would couple infrastructure to a host.

## Decision

Fleet MCP is the stable, versioned product boundary and each Harness is an external host. Fleet does not build a chat UI, Agent Framework, model Router, or Harness Router. Product deployments may recommend one Reference Harness based on measured stability, tool-call quality, and deployment experience. Other Harnesses remain compatibility targets using the same Fleet MCP. A future clearly superior Harness may become the recommendation without changing the standard Fleet MCP interface.

Harness-specific configuration and presentation remain outside domain and control-plane. The H0.1 protocol is `Fleet MCP Contract v0.1`.

## Scope

Fleet MCP transport/contract, Harness compatibility tests, and thin deployment profiles.

## Non-goals

This ADR does not select the Reference Harness, install a Harness, implement a Router, add a UI, or begin real-iOS M0/M1.

## OSS Evaluation

Initial candidates are limited to DeepSeek Harness and MiMo Code. Evidence is recorded in `docs/oss/2026-09-07-h0-reference-harness-candidates.md`.

## Consequences

All candidates must pass one compatibility contract against one unmodified Fleet MCP. Product recommendations may differ, but Fleet business logic cannot fork per Harness.

## Risks

Harness preview releases and MCP implementations may change. Versioned profiles and black-box tests must detect drift before deployment.

## Validation Gate

H0.1 requires stdio discovery and a safe mock job/evidence round trip through a standard MCP client. Candidate-specific C1–C9 runs occur only after a later installation decision.

## Rollback/Revisit trigger

Revisit if the MCP standard can no longer express a required Fleet safety boundary, or if both evaluated Harnesses cannot pass the shared compatibility contract without Fleet business forks.
