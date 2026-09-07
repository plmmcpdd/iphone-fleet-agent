# Mobile-Agent Mac/iPhone Handoff — MA2 Entry Contract

MA1 is a Windows/WSL architecture and mock-integration result. **REAL IOS = NOT TESTED.** This document prepares, but does not execute, `MA2 — ONE IPHONE PHONE OPERATOR POC`.

## Target and stop rule

- Use one dedicated iPhone SE2 with an explicit UDID mapped to exactly one Fleet `deviceId`.
- Never select “the first connected device”. Every probe and action must echo and validate the requested UDID.
- Use only a dedicated test account, approved network assignment, current Lease and fencing token.
- Stop on any device/account/network/context mismatch, WDA instability, stale fencing token, incomplete Evidence, or unapproved human gate.

The machine-readable contract is `scripts/doctor/mobile-agent-mac-doctor.ts`. Passing its automatic checks means only `READY_FOR_HUMAN_GATES`; it is not an iOS PASS.

## Prerequisites

Record macOS, Xcode, iOS, device model, WDA, MobileNext/mobilecli and Fleet revision. Verify Xcode command-line tools and signing; then complete USB connection, unlock, Trust This Computer, Developer Mode, Apple/Xcode sign-in and the safe-test-screen confirmation one prompt at a time.

The doctor must check pairing and WDA health, then use the explicit UDID for screenshot, foreground app, Home, tap, type, swipe, app launch and reconnect probes. Side-effect probes run only on an approved harmless screen and through `MobileNextDeviceBackend`; no direct Mobile-Agent-to-WDA path is permitted.

## MA2 test levels

1. Level 0: screenshot, foreground app, Home.
2. Level 1: open Settings or Safari and navigate harmless system UI.
3. Level 2: launch a target test app and browse/search without externally visible action.
4. Level 3: recover from an unexpected page, app reload or temporary observation failure.

Do not publish, comment, message, follow, like, pay, purchase, change a profile or alter a security setting in MA2.

## Evidence required per run

Preserve the bound ExecutionContext, UDID/device mapping, observation references, normalized actions, policy decisions, per-action Lease/fencing validation, backend results, Fleet verification, timing, model-call/token metrics when available, WDA/reconnect events and terminal result. Do not retain secrets or hidden model reasoning.

## Capacity gates

Scale only after the prior level is stable: MA2=1, MA3=2, MA4=4, MA5=6, MA6=9 devices. At each level record task success, wrong-device actions, disconnects, WDA failures, operator crashes, recovery success, latency, steps, model calls/tokens, CPU, RAM, GPU or API throughput, USB errors, Hatchet queue delay and Evidence completeness. Any instability stops scaling. Device-online count is not concurrent-production proof.
