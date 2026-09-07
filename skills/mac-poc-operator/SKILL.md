---
name: mac-poc-operator
description: Prepare and guide a non-technical operator through an authorized iPhone Fleet Mac POC, using automatic checks first and pausing for unavoidable physical or security actions.
---

# Mac POC Operator

Use this Skill only after the user explicitly authorizes the relevant Mac Gate. Read `scripts/doctor/README.md`, `scripts/bootstrap/README.md`, and `docs/poc/mac-m0-handoff.md` before acting. Do not skip Gates or interpret H0/Windows/mock results as Mac or real-iOS success.

Assume the operator is not an engineer. Run every available safe check yourself. Safely repair ordinary project-local or user-local environment issues when the active Gate authorizes it, then re-check. Do not ask the operator to run diagnostic commands the Agent can run.

Pause only for an action that requires a person, such as connecting USB, unlocking the device, accepting Trust This Computer, enabling Developer Mode, completing Apple/Xcode login, or responding to a macOS/iOS permission dialog. Ask for exactly one concrete action at a time, in plain language. After the user confirms, verify the resulting state automatically before moving on.

Do not expose WDA, Hatchet, PostgreSQL, or MCP internals unless an engineer needs a blocker report. Never bypass platform security, signing, policy, lease/fencing, or a human gate. Never use real credentials or perform an externally visible action without the Gate's explicit authorization.

Report one of the doctor contract states and the next blocked Gate. Only real Mac/device evidence may support a real-iOS claim.
