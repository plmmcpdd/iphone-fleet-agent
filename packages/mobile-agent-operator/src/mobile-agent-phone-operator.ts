import type {
  PhoneOperator,
  PhoneOperatorResult,
  PhoneOperatorRunOptions,
  PhoneOperatorTask,
} from "@iphone-fleet/application";
import { FleetError } from "@iphone-fleet/domain";
import type { FleetDeviceAdapter } from "@iphone-fleet/phone-operator";
import { normalizeMobileAgentAction } from "./action-normalizer.js";
import type { MobileAgentHistoryItem, MobileAgentRuntime } from "./runtime.js";

export interface MobileAgentPhoneOperatorDependencies {
  readonly runtime: MobileAgentRuntime;
  readonly device: FleetDeviceAdapter;
  readonly model: string;
}

export class MobileAgentPhoneOperator implements PhoneOperator {
  public constructor(private readonly dependencies: MobileAgentPhoneOperatorDependencies) {}

  public async run(
    task: PhoneOperatorTask,
    options: PhoneOperatorRunOptions = {},
  ): Promise<PhoneOperatorResult> {
    requireTask(task);
    if (!sameContext(task.executionContext, this.dependencies.device.context)) {
      return result("FAILED", 0, [], {
        code: "WRONG_DEVICE",
        message: "Operator context is not bound to its adapter",
        retryable: false,
      });
    }
    const startedAt = Date.now();
    const history: MobileAgentHistoryItem[] = [];
    const evidenceRefs: string[] = [];
    let screenshotCount = 0;
    let modelCallCount = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let consecutiveFailures = 0;

    try {
      await this.dependencies.runtime.start({
        context: task.executionContext,
        instruction: task.instruction,
        model: this.dependencies.model,
        maxSteps: task.limits.maxSteps,
        metadata: task.metadata,
      });

      for (let stepNumber = 1; stepNumber <= task.limits.maxSteps; stepNumber += 1) {
        throwIfStopped(options.signal, startedAt, task.limits.timeoutMs);
        const observation = await this.dependencies.device.observe(stepNumber);
        screenshotCount += 1;
        const remainingMs = remaining(startedAt, task.limits.timeoutMs);
        modelCallCount += 1;
        const proposal = await this.dependencies.runtime.next(
          { context: task.executionContext, observation, history, stepNumber },
          { signal: options.signal ?? new AbortController().signal, timeoutMs: remainingMs },
        );
        inputTokens += proposal.tokenUsage?.input ?? 0;
        outputTokens += proposal.tokenUsage?.output ?? 0;

        // A cancellation arriving after model inference must still prevent a late tap.
        throwIfStopped(options.signal, startedAt, task.limits.timeoutMs);
        const normalized = normalizeMobileAgentAction(proposal, observation);
        const commonDetails = {
          observationArtifactRef: observation.screenshotRef,
          proposedAction: redactedProposal(proposal),
          decisionSummary: proposal.decisionSummary ?? "Not provided",
          modelRuntime: this.dependencies.runtime.identity,
          tokenUsage: proposal.tokenUsage ?? { input: 0, output: 0 },
        };

        if (normalized.kind === "DEVICE_ACTION") {
          try {
            const executed = await this.dependencies.device.execute(
              stepNumber,
              normalized.action,
              commonDetails,
            );
            evidenceRefs.push(executed.evidenceId);
            history.push({
              stepNumber,
              observationRef: observation.screenshotRef,
              action: normalized.action.name,
              outcome: "SUCCEEDED",
            });
            consecutiveFailures = 0;
          } catch (error) {
            const failure = normalizeError(error);
            if (failure.code === "HUMAN_REQUIRED") {
              return result(
                "HUMAN_REQUIRED",
                stepNumber,
                evidenceRefs,
                failure,
                metrics(),
                undefined,
                { reason: failure.message },
              );
            }
            if (failure.code !== "ACTION_FAILED" && failure.code !== "DEVICE_BACKEND_ERROR")
              throw error;
            history.push({
              stepNumber,
              observationRef: observation.screenshotRef,
              action: normalized.action.name,
              outcome: failure.code,
            });
            consecutiveFailures += 1;
            if (consecutiveFailures >= task.limits.maxConsecutiveFailures) throw error;
          }
          continue;
        }

        if (normalized.kind === "WAIT") {
          const evidenceId = await this.dependencies.device.recordDecision(
            stepNumber,
            "SUCCEEDED",
            { ...commonDetails, normalizedAction: "wait", waitMs: normalized.milliseconds },
          );
          evidenceRefs.push(evidenceId);
          await abortableDelay(normalized.milliseconds, options.signal);
          history.push({
            stepNumber,
            observationRef: observation.screenshotRef,
            action: "wait",
            outcome: "SUCCEEDED",
          });
          continue;
        }

        if (normalized.kind === "HUMAN_REQUIRED") {
          const evidenceId = await this.dependencies.device.recordDecision(
            stepNumber,
            "NEEDS_HUMAN",
            { ...commonDetails, normalizedAction: "human_required", reason: normalized.reason },
          );
          evidenceRefs.push(evidenceId);
          return result(
            "HUMAN_REQUIRED",
            stepNumber,
            evidenceRefs,
            { code: "HUMAN_REQUIRED", message: normalized.reason, retryable: false },
            metrics(),
            undefined,
            { reason: normalized.reason },
          );
        }

        if (normalized.kind === "FAILED") {
          const evidenceId = await this.dependencies.device.recordDecision(stepNumber, "FAILED", {
            ...commonDetails,
            normalizedAction: "terminate",
            failure: normalized.message,
          });
          evidenceRefs.push(evidenceId);
          return result(
            "FAILED",
            stepNumber,
            evidenceRefs,
            { code: "ACTION_FAILED", message: normalized.message, retryable: false },
            metrics(),
          );
        }

        const verification = await this.dependencies.device.verify(task.verification);
        const verifiedEvidence = await this.dependencies.device.recordDecision(
          stepNumber,
          verification.verified ? "SUCCEEDED" : "FAILED",
          {
            ...commonDetails,
            normalizedAction: "completion_proposal",
            completionProposal: normalized.proposal,
            verificationResult: verification,
          },
        );
        evidenceRefs.push(verifiedEvidence);
        if (verification.verified) {
          return result("SUCCEEDED", stepNumber, evidenceRefs, undefined, metrics(), {
            proposal: normalized.proposal,
            verified: true,
          });
        }
        history.push({
          stepNumber,
          observationRef: observation.screenshotRef,
          action: "completion_proposal",
          outcome: "VERIFICATION_FAILED",
        });
        consecutiveFailures += 1;
        if (consecutiveFailures >= task.limits.maxConsecutiveFailures) {
          throw new FleetError(
            "VERIFICATION_FAILED",
            "Completion proposal failed Fleet verification",
          );
        }
      }
      throw new FleetError("MAX_STEPS_EXCEEDED", "PhoneOperator exhausted maxSteps");
    } catch (error) {
      const failure = normalizeError(error);
      const status =
        failure.code === "OPERATOR_CANCELLED"
          ? "CANCELLED"
          : failure.code === "TASK_TIMEOUT" || failure.code === "MODEL_TIMEOUT"
            ? "TIMED_OUT"
            : failure.code === "HUMAN_REQUIRED"
              ? "HUMAN_REQUIRED"
              : "FAILED";
      return result(
        status,
        history.length + (modelCallCount > history.length ? 1 : 0),
        evidenceRefs,
        failure,
        metrics(),
        undefined,
        status === "HUMAN_REQUIRED" ? { reason: failure.message } : undefined,
      );
    } finally {
      await this.dependencies.runtime.close().catch(() => undefined);
    }

    function metrics() {
      return {
        screenshotCount,
        modelCallCount,
        tokenUsage: { input: inputTokens, output: outputTokens },
      };
    }
  }
}

function result(
  status: PhoneOperatorResult["status"],
  stepCount: number,
  evidenceRefs: readonly string[],
  failure?: PhoneOperatorResult["failure"],
  metrics: {
    screenshotCount: number;
    modelCallCount: number;
    tokenUsage: { input: number; output: number };
  } = { screenshotCount: 0, modelCallCount: 0, tokenUsage: { input: 0, output: 0 } },
  completion?: PhoneOperatorResult["completion"],
  humanRequired?: PhoneOperatorResult["humanRequired"],
): PhoneOperatorResult {
  return {
    status,
    stepCount,
    evidenceRefs: [...evidenceRefs],
    ...metrics,
    ...(failure ? { failure } : {}),
    ...(completion ? { completion } : {}),
    ...(humanRequired ? { humanRequired } : {}),
  };
}

function requireTask(task: PhoneOperatorTask): void {
  if (!task.instruction.trim())
    throw new FleetError("INVALID_EXECUTION_CONTEXT", "Operator instruction is required");
  if (!Number.isInteger(task.limits.maxSteps) || task.limits.maxSteps <= 0)
    throw new FleetError("INVALID_EXECUTION_CONTEXT", "maxSteps must be positive");
  if (!Number.isInteger(task.limits.timeoutMs) || task.limits.timeoutMs <= 0)
    throw new FleetError("INVALID_EXECUTION_CONTEXT", "timeoutMs must be positive");
  if (
    !Number.isInteger(task.limits.maxConsecutiveFailures) ||
    task.limits.maxConsecutiveFailures <= 0
  )
    throw new FleetError("INVALID_EXECUTION_CONTEXT", "maxConsecutiveFailures must be positive");
}

function sameContext(
  left: PhoneOperatorTask["executionContext"],
  right: PhoneOperatorTask["executionContext"],
): boolean {
  return (Object.keys(left) as Array<keyof typeof left>).every((key) => left[key] === right[key]);
}

function throwIfStopped(
  signal: AbortSignal | undefined,
  startedAt: number,
  timeoutMs: number,
): void {
  if (signal?.aborted) throw new FleetError("OPERATOR_CANCELLED", "Fleet cancelled the operator");
  if (Date.now() - startedAt >= timeoutMs)
    throw new FleetError("TASK_TIMEOUT", "PhoneOperator task timed out");
}

function remaining(startedAt: number, timeoutMs: number): number {
  const value = timeoutMs - (Date.now() - startedAt);
  if (value <= 0) throw new FleetError("TASK_TIMEOUT", "PhoneOperator task timed out");
  return value;
}

function normalizeError(error: unknown): NonNullable<PhoneOperatorResult["failure"]> {
  const code = error instanceof FleetError ? error.code : "OPERATOR_CRASH";
  const retryable = [
    "OBSERVATION_FAILED",
    "ACTION_FAILED",
    "DEVICE_OFFLINE",
    "DEVICE_BACKEND_ERROR",
    "MODEL_TIMEOUT",
    "OPERATOR_CRASH",
  ].includes(code);
  return { code, message: error instanceof Error ? error.message : String(error), retryable };
}

function redactedProposal(proposal: import("./runtime.js").MobileAgentProposal) {
  return {
    action: proposal.action,
    coordinate: proposal.coordinate,
    coordinate2: proposal.coordinate2,
    button: proposal.button,
    status: proposal.status,
    textPresent: Boolean(proposal.text),
  };
}

function abortableDelay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted)
    return Promise.reject(new FleetError("OPERATOR_CANCELLED", "Fleet cancelled the operator"));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new FleetError("OPERATOR_CANCELLED", "Fleet cancelled the operator"));
      },
      { once: true },
    );
  });
}
