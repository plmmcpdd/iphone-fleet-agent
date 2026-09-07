export const macAutomaticCheckIds = [
  "canonical-repository",
  "macos-version",
  "xcode",
  "xcode-command-line-tools",
  "node",
  "corepack-pnpm",
  "git",
  "fleet-build",
  "fleet-mcp-stdio",
] as const;

export const macHumanGateIds = [
  "usb-connected",
  "device-unlocked",
  "trust-this-computer",
  "developer-mode",
  "apple-xcode-login",
  "macos-ios-permissions",
] as const;

export type MacAutomaticCheckId = (typeof macAutomaticCheckIds)[number];
export type MacHumanGateId = (typeof macHumanGateIds)[number];
export type DoctorCheckStatus = "PASS" | "FAIL" | "NOT_RUN";

export interface DoctorObservation {
  readonly id: MacAutomaticCheckId;
  readonly status: DoctorCheckStatus;
  readonly detail: string;
}

export interface MacDoctorAssessment {
  readonly status: "BLOCKED" | "READY_FOR_HUMAN_GATES";
  readonly automaticChecks: readonly DoctorObservation[];
  readonly pendingHumanGates: readonly MacHumanGateId[];
}

export function assessMacDoctor(observations: readonly DoctorObservation[]): MacDoctorAssessment {
  const byId = new Map(observations.map((observation) => [observation.id, observation]));
  const automaticChecks = macAutomaticCheckIds.map(
    (id): DoctorObservation =>
      byId.get(id) ?? { id, status: "NOT_RUN", detail: "Required check was not run" },
  );
  return {
    status: automaticChecks.every((check) => check.status === "PASS")
      ? "READY_FOR_HUMAN_GATES"
      : "BLOCKED",
    automaticChecks,
    pendingHumanGates: macHumanGateIds,
  };
}
