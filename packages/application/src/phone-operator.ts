import type {
  DeviceVerification,
  ExecutionContext,
  PhoneObservation,
} from "@iphone-fleet/contracts";

export type PhoneOperatorStatus =
  | "SUCCEEDED"
  | "FAILED"
  | "HUMAN_REQUIRED"
  | "CANCELLED"
  | "TIMED_OUT";

export interface PhoneOperatorLimits {
  readonly maxSteps: number;
  readonly timeoutMs: number;
  readonly maxConsecutiveFailures: number;
}

export interface PhoneOperatorTask {
  readonly executionContext: ExecutionContext;
  readonly instruction: string;
  readonly limits: PhoneOperatorLimits;
  readonly policyProfile: string;
  readonly verification: DeviceVerification;
  readonly workflowRevision: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface PhoneOperatorFailure {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
}

export interface PhoneOperatorResult {
  readonly status: PhoneOperatorStatus;
  readonly completion?: {
    readonly proposal: string;
    readonly verified: boolean;
  };
  readonly humanRequired?: { readonly reason: string };
  readonly stepCount: number;
  readonly screenshotCount: number;
  readonly modelCallCount: number;
  readonly tokenUsage?: { readonly input: number; readonly output: number };
  readonly evidenceRefs: readonly string[];
  readonly failure?: PhoneOperatorFailure;
}

export interface PhoneOperatorRunOptions {
  readonly signal?: AbortSignal;
}

export interface PhoneOperator {
  run(task: PhoneOperatorTask, options?: PhoneOperatorRunOptions): Promise<PhoneOperatorResult>;
}

export interface PhoneOperatorDevice {
  observe(context: ExecutionContext, stepNumber: number): Promise<PhoneObservation>;
}
