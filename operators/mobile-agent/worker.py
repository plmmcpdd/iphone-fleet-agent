"""Fleet internal Mobile-Agent JSONL worker.

MA1 enables only RECORDED_MODEL_FIXTURE. A later live mode may import model
helpers from the pinned upstream checkout, but this worker must never import
AdbTools or own a device connection.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Any

PROTOCOL = "fleet-mobile-agent-jsonl/0.1"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fixture", type=Path)
    return parser.parse_args()


def respond(request_id: str, ok: bool, *, result: Any = None, code: str = "", message: str = "") -> None:
    frame: dict[str, Any] = {"protocol": PROTOCOL, "requestId": request_id, "ok": ok}
    if ok:
        frame["result"] = result
    else:
        frame["error"] = {"code": code, "message": message}
    sys.stdout.write(json.dumps(frame, separators=(",", ":")) + "\n")
    sys.stdout.flush()


def main() -> int:
    args = parse_args()
    fixture = json.loads(args.fixture.read_text(encoding="utf-8")) if args.fixture else None
    context: dict[str, Any] | None = None
    proposals = fixture.get("proposals", []) if fixture else []
    cancelled = False

    for line in sys.stdin:
        try:
            frame = json.loads(line)
            request_id = str(frame["requestId"])
            if frame.get("protocol") != PROTOCOL:
                respond(request_id, False, code="OPERATOR_CRASH", message="Protocol mismatch")
                continue
            method = frame.get("method")
            payload = frame.get("payload", {})
            if method == "health":
                respond(request_id, True, result={"status": "READY", "mode": "RECORDED_MODEL_FIXTURE" if fixture else "LIVE_MODEL_NOT_TESTED"})
            elif method == "start":
                proposed_context = payload.get("context", {})
                if context and proposed_context.get("deviceId") != context.get("deviceId"):
                    respond(request_id, False, code="MODEL_ERROR", message="Worker cannot switch devices")
                    continue
                if not fixture:
                    respond(request_id, False, code="MODEL_ERROR", message="LIVE_MODEL_NOT_TESTED")
                    continue
                context = proposed_context
                respond(request_id, True, result={"session": "STARTED", "deviceId": context.get("deviceId")})
            elif method == "next":
                if cancelled:
                    respond(request_id, False, code="OPERATOR_CANCELLED", message="Session cancelled")
                    continue
                if not context or payload.get("context", {}).get("deviceId") != context.get("deviceId"):
                    respond(request_id, False, code="MODEL_ERROR", message="Step context does not match bound device")
                    continue
                step = int(payload.get("stepNumber", 0))
                item = proposals[step - 1] if 0 < step <= len(proposals) else None
                if item is None:
                    respond(request_id, False, code="MODEL_ERROR", message="Recorded fixture exhausted")
                    continue
                if item.get("crash"):
                    os._exit(17)
                if item.get("delayMs"):
                    time.sleep(float(item["delayMs"]) / 1000)
                proposal = {key: value for key, value in item.items() if key not in {"delayMs", "crash"}}
                respond(request_id, True, result=proposal)
            elif method == "cancel":
                cancelled = True
                respond(request_id, True, result={"cancelled": True})
            elif method == "close":
                respond(request_id, True, result={"closed": True})
                return 0
            else:
                respond(request_id, False, code="MODEL_ERROR", message=f"Unknown method: {method}")
        except Exception as error:  # fail closed at the process boundary
            request_id = str(locals().get("frame", {}).get("requestId", "unknown"))
            respond(request_id, False, code="OPERATOR_CRASH", message=str(error))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
