# OSS Evaluation: Mobile-Agent-v3.5 and GUI-Owl-1.5

- Status: Evaluated; accepted for experimental integration
- Date: 2026-09-07
- Gate: MA1
- Machine-readable pin: `vendor/upstream-lock.json`

## Candidates

| Component | Exact source | License | Decision |
| --- | --- | --- | --- |
| Mobile-Agent-v3.5 | `X-PLUG/MobileAgent` at `11cea575561fb7800b5fb6b6cafa56f7a91de11f` | Root MIT; bundled AndroidWorld subtree Apache-2.0 with included notices | Use only the v3.5 single-device reasoning/model seam; do not vendor or execute the ADB/AndroidWorld environment path. |
| GUI-Owl-1.5-8B-Instruct | `mPLUG/GUI-Owl-1.5-8B-Instruct` at `06d5faecff74840bab2be2425e9c42667a5d04fc` | Model card MIT | Preferred MA1 model identity; weights are not downloaded and the model is not hard-coded into Fleet domain or MCP. |
| Qwen3-VL base | Official Qwen3-VL model family | Apache-2.0 | Compatible base-model inheritance; retain attribution on any future redistribution. |

## License hard gate

The official sources reviewed contain no research-only, educational-only, non-commercial, no-group-control, no-multi-device, no-multi-account, or other field-of-use restriction. MIT permits commercial use, modification and distribution subject to retaining its notice. Apache-2.0 similarly permits commercial use subject to its license and NOTICE obligations.

Result: `PRODUCTION_LICENSE_GATE_PASS`.

This is an engineering review, not a substitute for deployment counsel. Hosted providers may impose separate service terms; this evaluation covers the pinned source/model artifacts, not Alibaba Cloud, ModelScope, or any other hosted endpoint.

## Activity and maturity

The upstream repository is active and contains the v3.5 phone, computer, browser and benchmark implementations. Its official v3.5 README explicitly states that device tool debugging currently supports Android only and iOS is not supported. The phone runner is a compact screenshot/model/action loop coupled directly to `AdbTools`; the deeper AndroidWorld evaluation path contains planner, executor, reflector, notetaker and `InfoPool` components but is also Android-specific.

Therefore MA1 may validate an adapter architecture on Windows with a recorded model fixture. It cannot claim upstream iOS support, production readiness, or real-device compatibility.

## API and extension seam

The phone runner has no stable plugin interface for replacing ADB. Its reusable seams are the GUI-Owl message builder/model wrapper, normalized 0–1000 coordinates, action schema and bounded recent-image history. Fleet will use a private JSONL worker protocol and a Fleet-owned device adapter instead of patching the upstream checkout. The worker may import the pinned upstream model helpers in future live-model mode, but must never import or instantiate `AdbTools`.

## Dependencies

The standalone phone README names `qwen_agent`, `qwen_vl_utils` and `numpy`; its helper also imports Pillow and an OpenAI-compatible client through Qwen tooling. The bundled AndroidWorld `requirements.txt` includes AndroidEnv, dm-env, adb-related tooling, torch/vision and benchmark dependencies. Those AndroidWorld dependencies are not MA1 runtime dependencies.

No Python dependency is added to the Fleet lock in MA1. The checked-in worker uses only the Python standard library for `RECORDED_MODEL_FIXTURE`; a later live-model environment must have its own fully pinned requirements and NOTICE inventory before activation.

## Overlap and boundaries

- Fleet/Hatchet retain Registry, Lease, fencing, Policy, Job state, scheduling, concurrency, Evidence authority and Human Gate.
- Mobile-Agent supplies per-device GUI reasoning, action proposal, short-term history and GUI-level recovery.
- GUI-Owl supplies model inference only.
- `FleetDeviceAdapter` is the sole legal route to `DeviceBackend`.
- OpenAdapt remains the record/compile/replay candidate for mature deterministic flows.

## Alternatives

Rewriting the agent in TypeScript was rejected because it would duplicate upstream behavior and increase upgrade burden. Direct ADB subprocess wrapping was rejected because it violates iOS and Fleet device-ownership boundaries. A public HTTP API or second MCP was rejected because this is an internal runtime bridge. GELab is deferred to benchmarking only.

## Adoption conclusion

Accepted for experimental integration with `NO LONG-TERM FORK` as the target. A pinned, gitignored upstream checkout plus a machine-readable manifest is sufficient. Any need to modify upstream core, any newly discovered restrictive term, or failure of the iOS adapter seam triggers a new OSS Evaluation and ADR review.
