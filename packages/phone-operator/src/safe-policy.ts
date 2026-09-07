import type { DeviceAction, ExecutionContext } from "@iphone-fleet/contracts";
import type { PolicyDecision, PolicyEvaluator } from "@iphone-fleet/domain";

const readOnlyNavigationActions = new Set(["open_app", "swipe", "back", "home"]);
const sensitiveActions = new Set([
  "tap",
  "long_press",
  "type_text",
  "publish",
  "post",
  "like",
  "follow",
  "comment",
  "message",
  "dm",
  "profile_change",
  "delete",
  "purchase",
  "payment",
  "security_setting_change",
  "account_recovery",
  "credential_export",
]);

export class SafePhoneOperatorPolicy implements PolicyEvaluator {
  public async evaluate(_context: ExecutionContext, action: DeviceAction): Promise<PolicyDecision> {
    if (readOnlyNavigationActions.has(action.name)) {
      return { outcome: "ALLOW", reason: "MA1 read-only navigation allow-list" };
    }
    if (sensitiveActions.has(action.name)) {
      return {
        outcome: "REQUIRE_HUMAN",
        reason: `MA1 safe profile requires a human for ${action.name}`,
      };
    }
    return { outcome: "DENY", reason: `MA1 safe profile denies ${action.name}` };
  }
}
