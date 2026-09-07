# Mobile-Agent-v3.5 Integration Map

Pinned source: `X-PLUG/MobileAgent@11cea575561fb7800b5fb6b6cafa56f7a91de11f`.

## Upstream reality

The production-relevant phone sample is `Mobile-Agent-v3.5/mobile_use/run_gui_owl_1_5_for_mobile.py`. It is a single bounded loop that captures an ADB screenshot, builds GUI-Owl messages using a short recent-image history, parses one tool call, rescales 0–1000 coordinates, performs an ADB action and repeats. `utils.py` contains the ADB wrapper, model wrapper, prompt/action schema, history construction and app-name resolver.

The AndroidWorld evaluation subtree additionally contains multi-role planner/executor/reflector/notetaker and `InfoPool` state. That code is useful as a reference for progress/reflection semantics, but it is not the phone runner's extension API and pulls in AndroidWorld/ADB ownership.

## KEEP / ADAPT / REPLACE / DO_NOT_USE

| Upstream component | Classification | Fleet treatment |
| --- | --- | --- |
| GUI-Owl model call and tool-call proposal | KEEP | Preserve behind the internal model-runtime interface; recorded fixture in MA1, opt-in live endpoint later. |
| Relative 0–1000 coordinate convention | KEEP | Normalize deterministically against Fleet observation dimensions. |
| Bounded recent screenshot/action history | KEEP | Preserve the bounded-history behavior; instrument screenshots, calls, steps and token usage. |
| Task progress, reflection and completion proposal | KEEP | Retain as model/runtime-owned per-device context; Fleet independently verifies completion. |
| `build_messages` / `GUIOwlWrapper` | ADAPT | Future live Python worker may load these from the pinned checkout without copying or patching them. |
| Monolithic `main()` loop | ADAPT | Split at the observation/action boundary: Python owns proposal/history, TypeScript owns safety orchestration and device side effects. |
| `open` app-name/package resolution | ADAPT | Model proposes an app name; Fleet backend resolves platform-specific identity. Android package discovery is removed. |
| Declared actions `key`, `click`, `long_press`, `swipe`, `type`, `system_button`, `open`, `wait`, `answer`, `interact`, `terminate` | ADAPT | Parse the complete vocabulary and known runner aliases (`scroll`, `call_user`, `calluser`); normalize to vendor-neutral actions or fail closed. |
| `AdbTools` screenshots/input/app launch | REPLACE | `FleetDeviceAdapter` + `DeviceBackend.observe/execute`. |
| Android package list and `PACKAGES_NAME_DICT` ownership | REPLACE | Backend/platform adapter owns app resolution for its one explicit device. |
| CLI API key/base URL arguments | REPLACE | Environment/secret-provider configuration only; no secrets in requests, fixtures or Evidence. |
| AndroidWorld environment, device discovery and task registry | DO_NOT_USE | Conflicts with Fleet Registry, Lease, scheduling and iOS target. |
| Any direct ADB/uiautomator/package-manager fallback | DO_NOT_USE | No hidden fallback is allowed on the Fleet integration path. |
| Upstream interactive `input()` for install/challenge | DO_NOT_USE | Return `HUMAN_REQUIRED` to Fleet/Hatchet durable wait. |

## Action map from pinned source

| Upstream action | MA1 result |
| --- | --- |
| `click` | `tap`; side effect, policy and lease/fencing checked. |
| `long_press` | `long_press`; side effect, policy and lease/fencing checked. |
| `type` | `type_text`; sensitive by default and Human Gate/deny under safe profile. |
| `swipe`, runner alias `scroll` | `swipe`; side effect, policy and lease/fencing checked. |
| `system_button` Back/Home | `back` / `home`; explicit mapping. |
| `system_button` Menu/Enter | `UNSUPPORTED_OPERATOR_ACTION` in MA1 because portable iOS semantics are not qualified. |
| `open` | `open_app` using a human-readable app name; no Android package ownership. |
| `wait` | Operator-local bounded wait; no device side effect. |
| `answer` | Completion proposal carrying a user-visible answer; Fleet verification still required. |
| `interact`, runner aliases `call_user`, `calluser` | `HUMAN_REQUIRED`. |
| `terminate(success)` | Completion proposal; Fleet verification still required. |
| `terminate(failure)` | Explicit operator failure. |
| `key` | Fail closed; declared by schema but not implemented by the pinned phone runner. |
| Any other action | `UNSUPPORTED_OPERATOR_ACTION`; never ignored. |

## Patch burden

No upstream file is modified or copied. MA1 adds an external adapter and a standard-library JSONL worker. Live GUI-Owl loading remains disabled until a separately pinned Python environment exists. Current patch burden against upstream: zero.
