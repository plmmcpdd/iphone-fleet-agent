# Gate A4 — Hatchet Orchestration

- Status: PASS
- Date: 2026-09-05
- Environment: Windows build; official Hatchet Embedded sidecar in WSL Ubuntu-E
- Engine: Hatchet Embedded v0.105.16, SHA-256 pinned
- SDK: `@hatchet-dev/typescript-sdk` 1.31.0

## Implemented

- Thin Hatchet workflow: reserve → device action → verify → evidence → success.
- Dynamic concurrency key `input.context.deviceId` and dynamic maximum `input.deviceConcurrency`, required to be one.
- Official Hatchet retry for transient device-action failure.
- Worker routing label `runtime=wsl`, worker role label and four normal/durable slots.
- Durable `fleet:human-resume` event wait scoped by `jobId`.
- Full nine-field `ExecutionContext` validation at orchestration boundaries.

## Verification

- Build/typecheck: PASS.
- Same-device observed maximum action concurrency: 1.
- All-device observed maximum action concurrency: 2.
- Injected action attempts: 0, 1; Hatchet performed the retry.
- Durable wait was evicted cleanly when worker 1 stopped, claimed by worker 2, and resumed from an event sent while no worker owned the wait.
- All completed workflows contained terminal `SUCCEEDED` output and verified evidence.

## Failure injection and fixes

- An injected transient device action failed attempt zero and succeeded only after the engine scheduled attempt one.
- The first recovery test stopped the worker before the durable-wait registration handshake completed. The test now waits for server acknowledgement before simulating worker loss; the second and third runs passed with an explicit `Evicted 1 waiting durable run(s)` engine signal.
- The SDK leaves a result-listener retry briefly active during embedded shutdown. The verifier exits explicitly after the sidecar has stopped; this does not suppress workflow failures, which are asserted before shutdown.

## Boundary evidence

No Scheduler, Job queue, Workflow Engine or Job XState machine was implemented. Fleet code only declares workflows, tasks, routing constraints and adapters through the official SDK. No Hatchet private type enters domain/contracts.
