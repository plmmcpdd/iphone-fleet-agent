import { describe, expect, it } from "vitest";
import {
  assessMacDoctor,
  macAutomaticCheckIds,
  macHumanGateIds,
} from "../scripts/doctor/mac-poc-contract.js";

describe("Mac POC doctor contract", () => {
  it("fails closed when any automatic check is missing or failed", () => {
    const assessment = assessMacDoctor([
      { id: "canonical-repository", status: "PASS", detail: "canonical path confirmed" },
      { id: "macos-version", status: "FAIL", detail: "not running on macOS" },
    ]);
    expect(assessment.status).toBe("BLOCKED");
    expect(assessment.automaticChecks).toHaveLength(macAutomaticCheckIds.length);
    expect(assessment.automaticChecks).toContainEqual({
      id: "xcode",
      status: "NOT_RUN",
      detail: "Required check was not run",
    });
  });

  it("can only advance to explicit human gates after every automatic check passes", () => {
    const assessment = assessMacDoctor(
      macAutomaticCheckIds.map((id) => ({ id, status: "PASS" as const, detail: `${id} ok` })),
    );
    expect(assessment.status).toBe("READY_FOR_HUMAN_GATES");
    expect(assessment.pendingHumanGates).toEqual(macHumanGateIds);
    expect(assessment.status).not.toContain("M0");
  });
});
