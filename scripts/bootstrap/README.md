# Mac POC bootstrap contract

The future bootstrap is an idempotent, observable helper for a non-technical Mac operator. H0 provides no installer and performs no Mac changes.

Requirements for its later implementation:

1. Default to inspection/dry-run and report every intended change.
2. Automate safe project-local setup, repository build, Fleet MCP stdio smoke checks, and ordinary user-local fixes allowed by the active Gate.
3. Never change network settings, bypass macOS/iOS security, invent signing identities, store credentials in the repo, or install Mobile MCP/Mobilewright before approval.
4. Delegate environment facts to the doctor contract and stop on `BLOCKED`.
5. Ask the operator only for unavoidable physical/security actions, one concrete action per prompt, then re-check automatically.
6. Use plain operator language; keep WDA, Hatchet, PostgreSQL, and MCP internals in diagnostic logs unless needed by an engineer.
