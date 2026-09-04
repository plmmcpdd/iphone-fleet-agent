import type { DeviceAction, ExecutionContext } from "@iphone-fleet/contracts";

export type PolicyDecision =
  | { readonly outcome: "ALLOW"; readonly reason: string }
  | { readonly outcome: "DENY"; readonly reason: string }
  | { readonly outcome: "REQUIRE_HUMAN"; readonly reason: string };

export interface PolicyEvaluator {
  evaluate(context: ExecutionContext, action: DeviceAction): Promise<PolicyDecision>;
}

export class DenyByDefaultPolicy implements PolicyEvaluator {
  public async evaluate(): Promise<PolicyDecision> {
    return { outcome: "DENY", reason: "No explicit policy allowed the action" };
  }
}
