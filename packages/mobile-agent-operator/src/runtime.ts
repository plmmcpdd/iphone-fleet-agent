import type { ExecutionContext, PhoneObservation } from "@iphone-fleet/contracts";

export interface MobileAgentProposal {
  readonly action: string;
  readonly coordinate?: readonly [number, number];
  readonly coordinate2?: readonly [number, number];
  readonly text?: string;
  readonly time?: number;
  readonly button?: string;
  readonly status?: string;
  readonly decisionSummary?: string;
  readonly tokenUsage?: { readonly input: number; readonly output: number };
}

export interface MobileAgentHistoryItem {
  readonly stepNumber: number;
  readonly observationRef: string;
  readonly action: string;
  readonly outcome: string;
}

export interface MobileAgentSession {
  readonly context: ExecutionContext;
  readonly instruction: string;
  readonly model: string;
  readonly maxSteps: number;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface MobileAgentStepInput {
  readonly context: ExecutionContext;
  readonly observation: PhoneObservation;
  readonly history: readonly MobileAgentHistoryItem[];
  readonly stepNumber: number;
}

export interface MobileAgentRuntime {
  readonly identity: string;
  start(session: MobileAgentSession): Promise<void>;
  next(
    input: MobileAgentStepInput,
    options: { readonly signal: AbortSignal; readonly timeoutMs: number },
  ): Promise<MobileAgentProposal>;
  cancel(reason: string): Promise<void>;
  close(): Promise<void>;
}
