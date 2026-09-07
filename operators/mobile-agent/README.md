# Mobile-Agent internal worker

This is a private JSONL process boundary, not an MCP server or public API. MA1 supports only `RECORDED_MODEL_FIXTURE`; `LIVE_MODEL_NOT_TESTED` is intentional. The worker never imports ADB, AndroidWorld, WDA or `DeviceBackend`, and it never receives fleet inventory.

Protocol frames carry `fleet-mobile-agent-jsonl/0.1`, a request id and correlation id. Stdout is protocol-only; diagnostics use stderr. The TypeScript supervisor permits one in-flight request and owns timeout, cancellation and crash handling.
