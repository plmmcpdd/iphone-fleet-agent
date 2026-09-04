# OSS Evaluation: A5 OpenTelemetry and Agent Skills

- Status: Adopted for A5
- Date: 2026-09-05
- Related ADR: `docs/adr/0004-framework-responsibility-boundaries.md`

## Candidate

OpenTelemetry JavaScript API 1.9.1, SDK trace base 2.11.0, and the Agent Skills open format.

## Official repository

- https://github.com/open-telemetry/opentelemetry-js
- https://github.com/agentskills/agentskills

## License

Apache-2.0 for OpenTelemetry packages and Agent Skills code/specification. Agent Skills documentation is CC-BY-4.0.

## Activity

The exact npm versions were current on 2026-09-05. Both upstream repositories are active. Agent Skills remains a lightweight file format, not a service dependency.

## API / SDK

OpenTelemetry API supplies vendor-neutral spans and context attributes. The SDK trace base is used only to prove export behavior in integration tests. Agent Skills defines `SKILL.md` frontmatter and portable instructions.

## Self-host requirement

None. A5 has no telemetry backend, collector, Langfuse instance or Skill Registry Server. Local tests use the in-memory OTel exporter.

## Platform requirements

All A5 implementation and validation runs on Windows Native. The libraries are Node-compatible and the Agent Skill is plain Markdown/YAML.

## Overlap

OpenTelemetry records telemetry; it does not own Evidence or Job state. Local Evidence is the audit artifact truth for this Gate. The Agent Skill is harness-neutral guidance and exposes no execution capability beyond Fleet MCP/fleetctl.

## Adapter feasibility

`withFleetSpan` is a small wrapper around the official API. `LocalEvidenceSink` implements the existing Evidence port. Neither requires a platform fork or custom observability service.

## Reasons for adoption/rejection

Adopted to avoid a proprietary telemetry contract and a custom skill service. Langfuse is intentionally deferred because A5 requires vendor-neutral core spans, not an LLM observability deployment.

## Validation evidence

Integration tests capture successful and failed spans, confirm all nine ExecutionContext attributes, persist evidence across sink instances, verify SHA-256, reject tampering and unsafe paths, and run a successful Control Plane job through the local Evidence adapter. The project Skill passes the bundled structural validator.
