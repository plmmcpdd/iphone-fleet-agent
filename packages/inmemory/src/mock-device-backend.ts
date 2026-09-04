import type { DeviceBackend } from "@iphone-fleet/application";
import type {
  DeviceAction,
  DeviceActionResult,
  DeviceId,
  DeviceVerification,
  DeviceVerificationResult,
  ExecutionContext,
} from "@iphone-fleet/contracts";
import { FleetError } from "@iphone-fleet/domain";
import type { Clock } from "./clock.js";
import { SystemClock } from "./clock.js";

export interface MockDeviceOptions {
  readonly online?: boolean;
  readonly failExecution?: boolean;
  readonly failVerification?: boolean;
  readonly initialState?: Readonly<Record<string, unknown>>;
}

export class MockDeviceBackend implements DeviceBackend {
  private readonly deviceState = new Map<DeviceId, Record<string, unknown>>();
  private readonly options = new Map<DeviceId, MockDeviceOptions>();
  public readonly calls: Array<{ context: ExecutionContext; action: DeviceAction }> = [];

  public constructor(private readonly clock: Clock = new SystemClock()) {}

  public configure(deviceId: DeviceId, options: MockDeviceOptions): void {
    this.options.set(deviceId, options);
    this.deviceState.set(deviceId, { ...(options.initialState ?? {}) });
  }

  public async health(deviceId: DeviceId): Promise<{ online: boolean; observedAt: string }> {
    return {
      online: this.options.get(deviceId)?.online ?? true,
      observedAt: this.clock.now().toISOString(),
    };
  }

  public async execute(
    context: ExecutionContext,
    action: DeviceAction,
  ): Promise<DeviceActionResult> {
    if (!context.deviceId) throw new FleetError("WRONG_DEVICE", "deviceId is required");
    const options = this.options.get(context.deviceId) ?? {};
    this.calls.push({ context: structuredClone(context), action: structuredClone(action) });
    if (options.failExecution) {
      return { outcome: "FAILED", observed: null, message: "Injected execution failure" };
    }
    const state = this.deviceState.get(context.deviceId) ?? {};
    if (action.name === "set_state") Object.assign(state, action.parameters);
    this.deviceState.set(context.deviceId, state);
    return { outcome: "SUCCEEDED", observed: structuredClone(state) };
  }

  public async verify(
    context: ExecutionContext,
    verification: DeviceVerification,
  ): Promise<DeviceVerificationResult> {
    const options = this.options.get(context.deviceId) ?? {};
    const observed = this.deviceState.get(context.deviceId) ?? {};
    if (options.failVerification) {
      return {
        verified: false,
        observed: structuredClone(observed),
        message: "Injected verification failure",
      };
    }
    const verified =
      verification.name === "state_contains" &&
      typeof verification.expected === "object" &&
      verification.expected !== null &&
      Object.entries(verification.expected).every(([key, value]) => observed[key] === value);
    return { verified, observed: structuredClone(observed) };
  }
}
