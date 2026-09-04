# OSS Evaluation: A6 OpenAdapt Flow

- Status: Adopted as a feasibility-qualified candidate
- Date: 2026-09-05
- Related ADR: `docs/adr/0003-oss-first-gate.md`, `docs/adr/0004-framework-responsibility-boundaries.md`

## Candidate

OpenAdapt Flow 1.35.0 from its published PyPI wheel. The full resolved Python environment is pinned in `spikes/openadapt/requirements.lock.txt`.

## Official repository

https://github.com/OpenAdaptAI/openadapt-flow

## License

MIT for the published package. The repository documents an isolated AGPL-3.0-only openIMIS reference environment that is excluded from published wheels; A6 installs only the wheel dependency path.

## Activity

Version 1.35.0 was uploaded to PyPI on 2026-09-04. The upstream repository labels the lifecycle Beta and actively maintains compiler, backend protocol, replayer and reporting.

## API / SDK

The public Python library exposes a six-method pixel `Backend` protocol, `Recorder`, `compile_recording`, `Replayer.run` and `render_run_report`. A6 calls these APIs directly; it does not use private compiler or runtime internals.

## Self-host requirement

Local-only. The package is installed into `/home/rong/.cache/iphone-fleet-agent/openadapt-flow-1.35.0`, an isolated WSL Python 3.12 virtualenv. No server, cloud resource, browser or model endpoint is used.

## Platform requirements

OpenAdapt Flow requires Python >=3.10,<3.13. A6 uses Ubuntu-E Python 3.12.3 and does not touch Windows Python. Heavy vision dependencies are isolated to this venv.

## Overlap

OpenAdapt owns recording, compilation, deterministic visual replay and run reporting. Fleet owns context, Policy, Lease/fencing, DeviceBackend adaptation and durable Evidence. Hatchet remains the Job/Workflow engine. The spike does not introduce a Fleet Flow DSL, compiler, replay or healing engine.

## Adapter feasibility

PASS for a no-device pixel backend. `SyntheticMobileBackend` supplies screenshots and consumes clicks through the public protocol. Fleet ExecutionContext is validated and retained by the adapter, intentionally not injected into OpenAdapt's generic IR. The official compiler produced a one-step bundle and the official replayer delivered exactly one action with two passing postconditions.

The upstream execution-target enum currently has web/windows/macos/linux/rdp/citrix but no mobile value. Library-driven custom backends still work with an unbound target in demo mode. A production mobile surface binding remains an M0+ unknown and must be solved by an upstream/additive adapter path, not a Fleet fork.

## Reasons for adoption/rejection

Accepted for continued feasibility because the complete record → compile → replay → report path works without forking or monkey-patching OpenAdapt. It is not yet selected as a production iOS flow backend: the result is honestly `COMPLETED_UNVERIFIED` because the synthetic spike has postconditions but no independent business-effect verifier or production authorization.

## Validation evidence

- One synthetic 320×568 mobile frame and click recorded.
- One workflow step compiled with OCR/template anchors and two postconditions.
- Replay used the template rung, delivered one adapter action and passed both postconditions.
- Report JSON, Markdown and before/after screenshots generated with SHA-256 digests.
- Nine-field Fleet ExecutionContext preserved at the adapter boundary.
- Zero model calls and zero external network calls during replay.
- No OpenAdapt source, DSL, compiler, replayer or healing code modified.
