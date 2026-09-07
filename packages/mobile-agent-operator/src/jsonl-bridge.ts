import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { FleetError } from "@iphone-fleet/domain";
import type {
  MobileAgentProposal,
  MobileAgentRuntime,
  MobileAgentSession,
  MobileAgentStepInput,
} from "./runtime.js";

const protocol = "fleet-mobile-agent-jsonl/0.1";

export interface JsonlMobileAgentBridgeOptions {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly env?: Readonly<Record<string, string>>;
}

interface PendingRequest {
  readonly requestId: string;
  readonly resolve: (value: unknown) => void;
  readonly reject: (error: Error) => void;
  readonly timer: NodeJS.Timeout;
  readonly abort?: () => void;
}

export class JsonlMobileAgentBridge implements MobileAgentRuntime {
  public readonly identity = "MOBILE_AGENT_PYTHON_JSONL";
  private child: ChildProcessWithoutNullStreams | undefined;
  private pending: PendingRequest | undefined;
  private nextRequestId = 1;
  private stderrTail = "";
  private correlationId: string | undefined;

  public constructor(private readonly options: JsonlMobileAgentBridgeOptions) {}

  public async start(session: MobileAgentSession): Promise<void> {
    this.ensureProcess();
    this.correlationId = session.context.correlationId;
    await this.request("health", {}, 5_000);
    await this.request("start", session, 5_000);
  }

  public async next(
    input: MobileAgentStepInput,
    options: { readonly signal: AbortSignal; readonly timeoutMs: number },
  ): Promise<MobileAgentProposal> {
    return (await this.request(
      "next",
      input,
      options.timeoutMs,
      options.signal,
    )) as MobileAgentProposal;
  }

  public async cancel(reason: string): Promise<void> {
    if (!this.child) return;
    this.child.stdin.write(
      `${JSON.stringify({ protocol, requestId: `cancel-${Date.now()}`, correlationId: this.correlationId ?? "unknown", method: "cancel", payload: { reason } })}\n`,
    );
    this.child.kill();
  }

  public async close(): Promise<void> {
    const child = this.child;
    if (!child) return;
    if (!child.killed && child.exitCode === null && !this.pending) {
      await this.request("close", {}, 1_000).catch(() => undefined);
    }
    if (child.exitCode === null) child.kill();
    this.child = undefined;
  }

  public diagnostics(): string {
    return redact(this.stderrTail).slice(-2_000);
  }

  private ensureProcess(): ChildProcessWithoutNullStreams {
    if (this.child && this.child.exitCode === null) return this.child;
    const child = spawn(this.options.command, [...this.options.args], {
      cwd: this.options.cwd,
      env: { ...process.env, ...this.options.env },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    this.child = child;
    createInterface({ input: child.stdout }).on("line", (line) => this.receive(line));
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      this.stderrTail = `${this.stderrTail}${redact(chunk)}`.slice(-4_000);
    });
    child.once("exit", (code, signal) => {
      const pending = this.pending;
      this.pending = undefined;
      if (pending) {
        clearTimeout(pending.timer);
        pending.reject(
          new FleetError(
            "OPERATOR_CRASH",
            `Mobile-Agent worker exited (${code ?? signal ?? "unknown"})`,
            { diagnostics: this.diagnostics() },
          ),
        );
      }
    });
    child.once("error", (error) => {
      this.rejectPending(
        new FleetError("OPERATOR_CRASH", `Mobile-Agent worker failed: ${error.message}`),
      );
    });
    return child;
  }

  private request(
    method: string,
    payload: unknown,
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<unknown> {
    if (this.pending)
      return Promise.reject(
        new FleetError("MODEL_ERROR", "JSONL worker backpressure allows one in-flight request"),
      );
    if (signal?.aborted)
      return Promise.reject(new FleetError("OPERATOR_CANCELLED", "Fleet cancelled the operator"));
    const child = this.ensureProcess();
    const requestId = String(this.nextRequestId++);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending = undefined;
        child.kill();
        reject(
          new FleetError(
            method === "next" ? "MODEL_TIMEOUT" : "OPERATOR_CRASH",
            `${method} request timed out`,
          ),
        );
      }, timeoutMs);
      const abort = signal
        ? () => {
            clearTimeout(timer);
            this.pending = undefined;
            child.kill();
            reject(new FleetError("OPERATOR_CANCELLED", "Fleet cancelled the operator"));
          }
        : undefined;
      if (abort) signal?.addEventListener("abort", abort, { once: true });
      this.pending = { requestId, resolve, reject, timer, ...(abort ? { abort } : {}) };
      child.stdin.write(
        `${JSON.stringify({ protocol, requestId, correlationId: this.correlationId ?? "initializing", method, payload })}\n`,
      );
    });
  }

  private receive(line: string): void {
    const pending = this.pending;
    if (!pending) return;
    let frame: {
      protocol?: string;
      requestId?: string;
      ok?: boolean;
      result?: unknown;
      error?: { code?: string; message?: string };
    };
    try {
      frame = JSON.parse(line) as typeof frame;
    } catch {
      this.rejectPending(new FleetError("OPERATOR_CRASH", "Worker emitted invalid JSONL framing"));
      this.child?.kill();
      return;
    }
    if (frame.protocol !== protocol || frame.requestId !== pending.requestId) {
      this.rejectPending(
        new FleetError("OPERATOR_CRASH", "Worker response did not match protocol/request id"),
      );
      this.child?.kill();
      return;
    }
    clearTimeout(pending.timer);
    this.pending = undefined;
    if (frame.ok) pending.resolve(frame.result);
    else
      pending.reject(
        new FleetError(
          mapWorkerCode(frame.error?.code),
          frame.error?.message ?? "Mobile-Agent worker error",
        ),
      );
  }

  private rejectPending(error: Error): void {
    const pending = this.pending;
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending = undefined;
    pending.reject(error);
  }
}

function mapWorkerCode(code: string | undefined) {
  const known = ["MODEL_ERROR", "MODEL_TIMEOUT", "OPERATOR_CRASH", "OPERATOR_CANCELLED"] as const;
  return known.includes(code as (typeof known)[number])
    ? (code as (typeof known)[number])
    : "MODEL_ERROR";
}

function redact(value: string): string {
  return value
    .replace(/(api[_-]?key|token|password|secret)\s*[=:]\s*[^\s]+/gi, "$1=[REDACTED]")
    .replace(/\b(sk-[A-Za-z0-9_-]{8,})\b/g, "[REDACTED]");
}
