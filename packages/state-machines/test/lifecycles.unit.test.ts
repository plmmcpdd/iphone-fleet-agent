import { describe, expect, it } from "vitest";
import { createActor } from "xstate";
import { accountMachine, deviceMachine, networkMachine } from "../src/index.js";

describe("domain lifecycle machines", () => {
  it("moves a device through enrollment, reservation and release", () => {
    const actor = createActor(deviceMachine).start();
    actor.send({ type: "BEGIN_ENROLLMENT" });
    actor.send({ type: "ENROLLMENT_SUCCEEDED" });
    actor.send({ type: "RESERVE" });
    expect(actor.getSnapshot().value).toBe("BUSY");
    actor.send({ type: "RELEASE" });
    expect(actor.getSnapshot().value).toBe("READY");
  });

  it("rejects an invalid device transition by preserving state", () => {
    const actor = createActor(deviceMachine).start();
    actor.send({ type: "RESERVE" });
    expect(actor.getSnapshot().value).toBe("DISCOVERED");
  });

  it("does not let an account skip human-controlled acquisition and login", () => {
    const actor = createActor(accountMachine).start();
    actor.send({ type: "ACTIVATE" });
    expect(actor.getSnapshot().value).toBe("PROCUREMENT_PENDING");
    actor.send({ type: "ACQUIRE" });
    actor.send({ type: "ASSIGN_DEVICE" });
    actor.send({ type: "BEGIN_LOGIN" });
    expect(actor.getSnapshot().value).toBe("LOGIN_PENDING");
  });

  it("requires network verification before READY", () => {
    const actor = createActor(networkMachine).start();
    actor.send({ type: "ASSIGN" });
    actor.send({ type: "VERIFY_SUCCEEDED" });
    expect(actor.getSnapshot().value).toBe("ASSIGNED");
    actor.send({ type: "BEGIN_VERIFY" });
    actor.send({ type: "VERIFY_SUCCEEDED" });
    expect(actor.getSnapshot().value).toBe("READY");
  });
});
