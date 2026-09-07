export const fleetErrorCodes = [
  "INVALID_EXECUTION_CONTEXT",
  "CONTEXT_MISMATCH",
  "WRONG_DEVICE",
  "WRONG_ACCOUNT",
  "WRONG_NETWORK_ASSIGNMENT",
  "DEVICE_NOT_ACTIONABLE",
  "ACCOUNT_NOT_ACTIONABLE",
  "NETWORK_NOT_ACTIONABLE",
  "LEASE_REQUIRED",
  "LEASE_EXPIRED",
  "STALE_FENCING_TOKEN",
  "LEASE_CONTEXT_MISMATCH",
  "DEVICE_ALREADY_LEASED",
  "POLICY_DENIED",
  "HUMAN_REQUIRED",
  "INVALID_LIFECYCLE_TRANSITION",
  "DEVICE_OFFLINE",
  "VERIFICATION_FAILED",
  "EVIDENCE_WRITE_FAILED",
  "JOB_NOT_FOUND",
  "OBSERVATION_FAILED",
  "ACTION_FAILED",
  "DEVICE_BACKEND_ERROR",
  "MODEL_ERROR",
  "MODEL_TIMEOUT",
  "OPERATOR_CRASH",
  "MAX_STEPS_EXCEEDED",
  "TASK_TIMEOUT",
  "UNSUPPORTED_OPERATOR_ACTION",
  "OPERATOR_CANCELLED",
] as const;

export type FleetErrorCode = (typeof fleetErrorCodes)[number];

export class FleetError extends Error {
  public readonly code: FleetErrorCode;
  public readonly details: Readonly<Record<string, unknown>>;

  public constructor(
    code: FleetErrorCode,
    message: string,
    details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = "FleetError";
    this.code = code;
    this.details = details;
  }
}
