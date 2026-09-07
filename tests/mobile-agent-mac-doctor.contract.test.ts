import { describe, expect, it } from "vitest";
import {
  assessMobileAgentMacDoctor,
  mobileAgentMacAutomaticCheckIds,
} from "../scripts/doctor/mobile-agent-mac-doctor.js";

describe("MA1 Mac doctor contract", () => {
  it("requires an explicit UDID", () => {
    expect(() => assessMobileAgentMacDoctor("", [])).toThrow(/explicit target UDID/);
  });

  it("blocks missing checks and observations from another device", () => {
    const assessment = assessMobileAgentMacDoctor("UDID-A", [
      { id: "macos", status: "PASS", detail: "macOS detected", udid: "UDID-B" },
    ]);
    expect(assessment.status).toBe("BLOCKED");
    expect(assessment.automaticChecks).toHaveLength(mobileAgentMacAutomaticCheckIds.length);
    expect(assessment.automaticChecks[0]?.status).toBe("FAIL");
    expect(assessment.automaticChecks[1]?.status).toBe("NOT_RUN");
  });

  it("can only become ready for human gates, never claim a real-iOS pass", () => {
    const targetUdid = "00008110-TEST-SE2";
    const assessment = assessMobileAgentMacDoctor(
      targetUdid,
      mobileAgentMacAutomaticCheckIds.map((id) => ({
        id,
        status: "PASS" as const,
        detail: `${id} verified`,
        udid: targetUdid,
      })),
    );
    expect(assessment.status).toBe("READY_FOR_HUMAN_GATES");
    expect(assessment.pendingHumanGates).toContain("developer-mode");
  });
});
