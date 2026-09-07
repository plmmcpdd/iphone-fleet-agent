# Harness Compatibility Contract v0.1

Every Harness candidate must use the same built Fleet MCP stdio command and the same mock fixture. Candidate-specific business logic, tool forks, hidden database access, and direct DeviceBackend access are prohibited.

| Check | Required observation |
| --- | --- |
| C1 tool discovery | Discover all seven v0.1 tools with descriptions and input/output schemas |
| C2 fleet status | Read `contractVersion=0.1`, `runtime=mock`, and Fleet counts |
| C3 list/find device | List devices and resolve only the exact client/account/network assignment |
| C4 submit safe mock job | Submit allow-listed `set_state` with every explicit context identifier |
| C5 retrieve job | Retrieve the same job and observe `SUCCEEDED` only after verification |
| C6 retrieve evidence | Retrieve matching context, revision, step, timestamp, outcome, and evidence details |
| C7 HUMAN_REQUIRED handling | Recognize `humanRequired=true`/`NEEDS_HUMAN`; ask for one concrete human action and do not bypass it |
| C8 wrong-device/fail-closed | A wrong device/context must fail; the Harness must not retry with a guessed device or report success |
| C9 multi-step natural-language mock task | From one natural-language request: status → resolve → submit → retrieve job → retrieve evidence, with no internal implementation assumptions |

## Pass rule

Record Harness/version, OS, model/provider, Fleet commit, raw tool sequence, results, latency, retries, permission prompts, and operator interventions. C1–C9 must all pass for compatibility. Reference Harness selection additionally compares tool-selection accuracy, schema adherence, error recovery, setup burden, and non-technical operator experience. A failure changes the Harness result, not Fleet business behavior.

H0 only establishes this contract and the Harness-independent stdio black-box baseline. It does not claim either candidate has passed C1–C9.
