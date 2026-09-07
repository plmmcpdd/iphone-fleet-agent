import type { DeviceAction, PhoneObservation } from "@iphone-fleet/contracts";
import { FleetError } from "@iphone-fleet/domain";
import type { MobileAgentProposal } from "./runtime.js";

export type NormalizedOperatorStep =
  | { readonly kind: "DEVICE_ACTION"; readonly action: DeviceAction }
  | { readonly kind: "WAIT"; readonly milliseconds: number }
  | { readonly kind: "COMPLETE"; readonly proposal: string }
  | { readonly kind: "HUMAN_REQUIRED"; readonly reason: string }
  | { readonly kind: "FAILED"; readonly message: string };

export function normalizeMobileAgentAction(
  proposal: MobileAgentProposal,
  observation: PhoneObservation,
): NormalizedOperatorStep {
  switch (proposal.action) {
    case "click":
      return {
        kind: "DEVICE_ACTION",
        action: {
          name: "tap",
          parameters: { coordinate: coordinate(proposal.coordinate, observation) },
        },
      };
    case "long_press":
      return {
        kind: "DEVICE_ACTION",
        action: {
          name: "long_press",
          parameters: {
            coordinate: coordinate(proposal.coordinate, observation),
            durationMs: seconds(proposal.time, 0.8) * 1_000,
          },
        },
      };
    case "type":
      return {
        kind: "DEVICE_ACTION",
        action: { name: "type_text", parameters: { text: requiredText(proposal.text, "type") } },
      };
    case "swipe":
    case "scroll":
      return {
        kind: "DEVICE_ACTION",
        action: {
          name: "swipe",
          parameters: {
            from: coordinate(proposal.coordinate, observation),
            to: coordinate(proposal.coordinate2, observation),
          },
        },
      };
    case "open":
      return {
        kind: "DEVICE_ACTION",
        action: { name: "open_app", parameters: { appName: requiredText(proposal.text, "open") } },
      };
    case "system_button": {
      const button = proposal.button?.toLowerCase();
      if (button === "back" || button === "home") {
        return { kind: "DEVICE_ACTION", action: { name: button, parameters: {} } };
      }
      throw unsupported(`system_button:${proposal.button ?? "missing"}`);
    }
    case "wait":
      return { kind: "WAIT", milliseconds: Math.min(seconds(proposal.time, 2) * 1_000, 10_000) };
    case "answer":
      return { kind: "COMPLETE", proposal: proposal.text ?? "Task answer proposed" };
    case "terminate":
      return proposal.status === "success"
        ? { kind: "COMPLETE", proposal: proposal.decisionSummary ?? "Task completion proposed" }
        : { kind: "FAILED", message: proposal.decisionSummary ?? "Mobile-Agent reported failure" };
    case "interact":
    case "call_user":
    case "calluser":
      return {
        kind: "HUMAN_REQUIRED",
        reason: proposal.text ?? "Mobile-Agent requested human interaction",
      };
    case "key":
      throw unsupported("key (declared upstream but not implemented by the pinned phone runner)");
    default:
      throw unsupported(proposal.action);
  }
}

function coordinate(
  value: readonly [number, number] | undefined,
  observation: PhoneObservation,
): readonly [number, number] {
  if (!value || value.some((item) => !Number.isFinite(item) || item < 0 || item > 1_000)) {
    throw unsupported("invalid-coordinate");
  }
  return [
    Math.round((value[0] / 1_000) * observation.screen.width),
    Math.round((value[1] / 1_000) * observation.screen.height),
  ];
}

function requiredText(value: string | undefined, action: string): string {
  if (!value?.trim()) throw unsupported(`${action}:missing-text`);
  return value;
}

function seconds(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && (value ?? 0) >= 0 ? (value as number) : fallback;
}

function unsupported(action: string): FleetError {
  return new FleetError(
    "UNSUPPORTED_OPERATOR_ACTION",
    `Unsupported Mobile-Agent action: ${action}`,
  );
}
