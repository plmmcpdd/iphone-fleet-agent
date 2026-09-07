export const mobileAgentMacAutomaticCheckIds = [
  "macos",
  "xcode",
  "xcode-command-line-tools",
  "explicit-udid",
  "wda-build-and-signing",
  "wda-health",
  "pairing-record",
  "mobilenext-mobilecli-version",
  "screenshot-probe",
  "foreground-app-probe",
  "home-probe",
  "tap-probe",
  "type-probe",
  "swipe-probe",
  "launch-probe",
  "reconnect-probe",
] as const;

export const mobileAgentMacHumanGateIds = [
  "usb-connected",
  "device-unlocked",
  "trust-this-computer",
  "developer-mode",
  "apple-xcode-login-and-signing-team",
  "safe-test-screen-confirmed",
] as const;

export type MobileAgentMacAutomaticCheckId = (typeof mobileAgentMacAutomaticCheckIds)[number];

export interface MobileAgentMacDoctorObservation {
  readonly id: MobileAgentMacAutomaticCheckId;
  readonly status: "PASS" | "FAIL" | "NOT_RUN";
  readonly detail: string;
  readonly udid: string;
}

export interface MobileAgentMacDoctorAssessment {
  readonly status: "BLOCKED" | "READY_FOR_HUMAN_GATES";
  readonly targetUdid: string;
  readonly automaticChecks: readonly MobileAgentMacDoctorObservation[];
  readonly pendingHumanGates: readonly (typeof mobileAgentMacHumanGateIds)[number][];
}

export function assessMobileAgentMacDoctor(
  targetUdid: string,
  observations: readonly MobileAgentMacDoctorObservation[],
): MobileAgentMacDoctorAssessment {
  if (targetUdid.trim().length === 0) {
    throw new Error(
      "An explicit target UDID is required; first-connected-device selection is forbidden",
    );
  }
  const byId = new Map(observations.map((observation) => [observation.id, observation]));
  const automaticChecks = mobileAgentMacAutomaticCheckIds.map(
    (id): MobileAgentMacDoctorObservation => {
      const observation = byId.get(id);
      if (!observation) {
        return { id, status: "NOT_RUN", detail: "Required check was not run", udid: targetUdid };
      }
      if (observation.udid !== targetUdid) {
        return {
          id,
          status: "FAIL",
          detail: "Observation UDID does not match the requested target",
          udid: observation.udid,
        };
      }
      return observation;
    },
  );
  return {
    status: automaticChecks.every((check) => check.status === "PASS")
      ? "READY_FOR_HUMAN_GATES"
      : "BLOCKED",
    targetUdid,
    automaticChecks,
    pendingHumanGates: mobileAgentMacHumanGateIds,
  };
}
