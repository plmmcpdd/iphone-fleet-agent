import { FleetError } from "@iphone-fleet/domain";
import type {
  MobileAgentProposal,
  MobileAgentRuntime,
  MobileAgentSession,
  MobileAgentStepInput,
} from "./runtime.js";

export interface RecordedRuntimeOptions {
  readonly proposals: readonly MobileAgentProposal[];
  readonly delayMs?: number;
  readonly crashAtStep?: number;
  readonly onProposal?: (stepNumber: number) => void;
}

export class RecordedMobileAgentRuntime implements MobileAgentRuntime {
  public readonly identity = "RECORDED_MODEL_FIXTURE";
  private started = false;
  private cancelled = false;

  public constructor(private readonly options: RecordedRuntimeOptions) {}

  public async start(_session: MobileAgentSession): Promise<void> {
    this.started = true;
  }

  public async next(
    input: MobileAgentStepInput,
    options: { readonly signal: AbortSignal; readonly timeoutMs: number },
  ): Promise<MobileAgentProposal> {
    if (!this.started) throw new FleetError("MODEL_ERROR", "Recorded runtime was not started");
    if (this.cancelled || options.signal.aborted)
      throw new FleetError("OPERATOR_CANCELLED", "Operator was cancelled");
    if (this.options.crashAtStep === input.stepNumber)
      throw new FleetError("OPERATOR_CRASH", "Injected operator crash");
    const delayMs = this.options.delayMs ?? 0;
    if (delayMs > options.timeoutMs) {
      await abortableDelay(options.timeoutMs, options.signal);
      throw new FleetError("MODEL_TIMEOUT", "Recorded model timed out");
    }
    await abortableDelay(delayMs, options.signal);
    const proposal = this.options.proposals[input.stepNumber - 1];
    if (!proposal)
      throw new FleetError("MODEL_ERROR", "Recorded fixture has no proposal for this step");
    this.options.onProposal?.(input.stepNumber);
    return structuredClone(proposal);
  }

  public async cancel(): Promise<void> {
    this.cancelled = true;
  }

  public async close(): Promise<void> {
    this.cancelled = true;
  }
}

function abortableDelay(milliseconds: number, signal: AbortSignal): Promise<void> {
  if (milliseconds <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new FleetError("OPERATOR_CANCELLED", "Operator was cancelled"));
      },
      { once: true },
    );
  });
}
