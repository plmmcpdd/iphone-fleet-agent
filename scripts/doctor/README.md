# Mac POC doctor contract

MA1 adds `mobile-agent-mac-doctor.ts`, the explicit-UDID readiness contract for the future MobileNext/WDA PhoneOperator path. It deliberately performs no device action on Windows and cannot emit a real-iOS PASS.

H0 defines the doctor result model but does not claim a Mac result. A future macOS implementation must run every `macAutomaticCheckIds` check automatically and pass observations to `assessMacDoctor`.

- Missing, failed, or unrun automatic checks make the result `BLOCKED`.
- Passing automatic checks yields only `READY_FOR_HUMAN_GATES`, never M0 PASS or real-iOS verified.
- The doctor must emit machine-readable IDs, status, and concise remediation evidence without credentials.
- Ordinary safe repairs may be offered or applied only within the later Gate's authorization. System/network changes, signing choices, credentials, and device security prompts are never inferred.
- Human gates are handled one at a time: USB, unlock, Trust This Computer, Developer Mode, Apple/Xcode login, then macOS/iOS permission prompts as they actually appear.
