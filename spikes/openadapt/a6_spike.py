"""A6 no-device feasibility spike using only OpenAdapt Flow public library APIs."""

from __future__ import annotations

import hashlib
import io
import json
import shutil
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw
from openadapt_flow.compiler import compile_recording
from openadapt_flow.ir import Workflow
from openadapt_flow.recorder import Recorder
from openadapt_flow.report import render_run_report
from openadapt_flow.runtime.replayer import Replayer

REPO_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_ROOT = (REPO_ROOT / ".runtime" / "openadapt-a6").resolve()
EXPECTED_CONTEXT_FIELDS = {
    "jobId",
    "clientId",
    "accountId",
    "deviceId",
    "networkAssignmentId",
    "leaseId",
    "fencingToken",
    "actorId",
    "correlationId",
}


def validate_context(context: dict[str, Any]) -> dict[str, Any]:
    if set(context) != EXPECTED_CONTEXT_FIELDS:
        raise ValueError("ExecutionContext must contain exactly the nine Fleet fields")
    if not all(context[key] for key in EXPECTED_CONTEXT_FIELDS - {"fencingToken"}):
        raise ValueError("ExecutionContext string fields must be non-empty")
    if not isinstance(context["fencingToken"], int) or context["fencingToken"] <= 0:
        raise ValueError("fencingToken must be a positive integer")
    return dict(context)


class SyntheticMobileBackend:
    """Thin pixel backend; it delegates compile/replay/verification to OpenAdapt Flow."""

    def __init__(self, context: dict[str, Any]) -> None:
        self.context = validate_context(context)
        self.state = "ready"
        self.actions: list[dict[str, Any]] = []

    @property
    def viewport(self) -> tuple[int, int]:
        return (320, 568)

    def screenshot(self) -> bytes:
        image = Image.new("RGB", self.viewport, "#f5f7fb")
        draw = ImageDraw.Draw(image)
        draw.rounded_rectangle((16, 16, 304, 552), radius=28, fill="#ffffff", outline="#20242b", width=3)
        draw.text((110, 90), "Synthetic iPhone", fill="#20242b")
        if self.state == "ready":
            draw.rounded_rectangle((70, 240, 250, 320), radius=16, fill="#2563eb")
            draw.text((142, 274), "TAP", fill="#ffffff")
        else:
            draw.rounded_rectangle((70, 240, 250, 320), radius=16, fill="#16a34a")
            draw.text((137, 274), "DONE", fill="#ffffff")
        output = io.BytesIO()
        image.save(output, format="PNG")
        return output.getvalue()

    def click(self, x: int, y: int, *, double: bool = False) -> None:
        if double or not (70 <= x <= 250 and 240 <= y <= 320):
            raise RuntimeError("synthetic mobile action targeted the wrong control")
        self.actions.append({"kind": "click", "x": x, "y": y, "context": self.context})
        self.state = "done"

    def type_text(self, text: str) -> None:
        self.actions.append({"kind": "type", "text": text, "context": self.context})

    def press(self, key: str) -> None:
        self.actions.append({"kind": "key", "key": key, "context": self.context})

    def scroll(self, dx: int, dy: int) -> None:
        self.actions.append({"kind": "scroll", "dx": dx, "dy": dy, "context": self.context})


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def prepare_output() -> None:
    runtime_root = (REPO_ROOT / ".runtime").resolve()
    if runtime_root not in OUTPUT_ROOT.parents:
        raise RuntimeError("refusing to clear an output outside the project runtime directory")
    if OUTPUT_ROOT.exists():
        shutil.rmtree(OUTPUT_ROOT)
    OUTPUT_ROOT.mkdir(parents=True)


def main() -> None:
    prepare_output()
    recording_dir = OUTPUT_ROOT / "recording"
    bundle_dir = OUTPUT_ROOT / "bundle"
    run_dir = OUTPUT_ROOT / "run"
    context = validate_context(
        {
            "jobId": "JOB-A6-001",
            "clientId": "CLIENT-A6",
            "accountId": "ACCOUNT-A6",
            "deviceId": "DEVICE-SYNTHETIC-IOS-001",
            "networkAssignmentId": "NETWORK-A6",
            "leaseId": "LEASE-A6",
            "fencingToken": 73,
            "actorId": "A6-SPIKE",
            "correlationId": "CORRELATION-A6",
        }
    )

    demonstration_backend = SyntheticMobileBackend(context)
    recorder = Recorder(
        demonstration_backend,
        recording_dir,
        settle_interval_s=0.01,
        settle_stable_frames=2,
        settle_timeout_s=1.0,
    )
    recorder.click(160, 280)
    recorder.finish()

    workflow = compile_recording(recording_dir, bundle_dir, name="synthetic-mobile-tap")
    replay_backend = SyntheticMobileBackend(context)
    report = Replayer(replay_backend).run(
        workflow,
        bundle_dir=bundle_dir,
        run_dir=run_dir,
        prior_external_network_calls="none",
    )
    report_path = run_dir / "report.json"
    markdown_path = render_run_report(run_dir)
    report_data = json.loads(report_path.read_text(encoding="utf-8"))
    serialized_report = json.dumps(report_data)

    if replay_backend.state != "done" or len(replay_backend.actions) != 1:
        raise AssertionError("OpenAdapt did not deliver exactly one replay action")
    if report_data.get("success") is not True or report_data.get("execution_completed") is not True:
        raise AssertionError("OpenAdapt replay did not complete successfully")
    if report_data.get("execution_outcome") != "COMPLETED_UNVERIFIED":
        raise AssertionError("no-effect spike must remain explicitly unverified")
    results = report_data.get("results", [])
    if len(results) != 1 or results[0].get("postconditions_ok") is not True:
        raise AssertionError("OpenAdapt postcondition verification did not pass")
    if context != replay_backend.actions[0]["context"]:
        raise AssertionError("ExecutionContext was not preserved at the adapter boundary")
    if not report_path.is_file() or not markdown_path.is_file():
        raise AssertionError("OpenAdapt report evidence was not generated")
    if "DEVICE-SYNTHETIC-IOS-001" in serialized_report:
        raise AssertionError("Fleet context unexpectedly leaked into OpenAdapt's generic IR report")

    boundary_evidence = {
        "gate": "A6",
        "openadaptFlowVersion": "1.35.0",
        "backend": "SyntheticMobileBackend",
        "context": context,
        "recordingEventCount": recorder.event_count,
        "compiledStepCount": len(workflow.steps),
        "replayedActionCount": len(replay_backend.actions),
        "reportOutcome": report_data.get("execution_outcome"),
        "postconditionsPassed": True,
        "reportDigest": f"sha256:{sha256(report_path)}",
        "markdownDigest": f"sha256:{sha256(markdown_path)}",
        "coreModified": False,
        "modelCalls": report_data.get("model_calls", 0),
    }
    (OUTPUT_ROOT / "fleet-boundary-evidence.json").write_text(
        json.dumps(boundary_evidence, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(boundary_evidence, indent=2))


if __name__ == "__main__":
    main()
