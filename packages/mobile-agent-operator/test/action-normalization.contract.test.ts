import type { PhoneObservation } from "@iphone-fleet/contracts";
import { describe, expect, it } from "vitest";
import { normalizeMobileAgentAction } from "../src/index.js";

const observation: PhoneObservation = {
  screenshotRef: "mock://screen",
  screen: { width: 320, height: 568 },
  foregroundApp: "SpringBoard",
  observedAt: "2026-09-07T00:00:00.000Z",
};

describe("Mobile-Agent-v3.5 action normalization", () => {
  it("maps the pinned runner's complete supported side-effect vocabulary", () => {
    expect(
      normalizeMobileAgentAction({ action: "click", coordinate: [500, 500] }, observation),
    ).toMatchObject({
      kind: "DEVICE_ACTION",
      action: { name: "tap", parameters: { coordinate: [160, 284] } },
    });
    expect(
      normalizeMobileAgentAction(
        { action: "long_press", coordinate: [100, 200], time: 1 },
        observation,
      ),
    ).toMatchObject({ action: { name: "long_press", parameters: { durationMs: 1_000 } } });
    expect(
      normalizeMobileAgentAction({ action: "type", text: "hello" }, observation),
    ).toMatchObject({ action: { name: "type_text" } });
    expect(
      normalizeMobileAgentAction(
        { action: "swipe", coordinate: [0, 0], coordinate2: [1_000, 1_000] },
        observation,
      ),
    ).toMatchObject({ action: { name: "swipe", parameters: { from: [0, 0], to: [320, 568] } } });
    expect(
      normalizeMobileAgentAction(
        { action: "scroll", coordinate: [500, 800], coordinate2: [500, 300] },
        observation,
      ),
    ).toMatchObject({ action: { name: "swipe" } });
    expect(
      normalizeMobileAgentAction({ action: "open", text: "Settings" }, observation),
    ).toMatchObject({ action: { name: "open_app", parameters: { appName: "Settings" } } });
    expect(
      normalizeMobileAgentAction({ action: "system_button", button: "Home" }, observation),
    ).toMatchObject({ action: { name: "home" } });
  });

  it("maps wait, answer, terminate and human interaction without a device action", () => {
    expect(normalizeMobileAgentAction({ action: "wait", time: 99 }, observation)).toEqual({
      kind: "WAIT",
      milliseconds: 10_000,
    });
    expect(normalizeMobileAgentAction({ action: "answer", text: "42" }, observation)).toEqual({
      kind: "COMPLETE",
      proposal: "42",
    });
    expect(
      normalizeMobileAgentAction({ action: "terminate", status: "failure" }, observation),
    ).toMatchObject({ kind: "FAILED" });
    for (const action of ["interact", "call_user", "calluser"]) {
      expect(normalizeMobileAgentAction({ action, text: "Unlock" }, observation)).toEqual({
        kind: "HUMAN_REQUIRED",
        reason: "Unlock",
      });
    }
  });

  it("fails closed for unknown, invalid-coordinate, key and unsupported system buttons", () => {
    for (const proposal of [
      { action: "unknown" },
      { action: "click", coordinate: [1_001, 0] as const },
      { action: "key", text: "ENTER" },
      { action: "system_button", button: "Menu" },
    ]) {
      expect(() => normalizeMobileAgentAction(proposal, observation)).toThrow(
        /Unsupported Mobile-Agent action/,
      );
    }
  });
});
