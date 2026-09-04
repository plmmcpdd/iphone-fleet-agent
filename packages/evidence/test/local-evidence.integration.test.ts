import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { EvidenceRecord } from "@iphone-fleet/application";
import { afterEach, describe, expect, it } from "vitest";
import { createMockFleetRuntime } from "../../control-plane/src/mock-runtime.js";
import { LocalEvidenceSink } from "../src/index.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function record(overrides: Partial<EvidenceRecord> = {}): EvidenceRecord {
  return {
    evidenceId: "EVIDENCE-A5-001",
    context: {
      jobId: "JOB-A5-001",
      clientId: "CLIENT-A5",
      accountId: "ACCOUNT-A5",
      deviceId: "DEVICE-A5",
      networkAssignmentId: "NETWORK-A5",
      leaseId: "LEASE-A5",
      fencingToken: 7,
      actorId: "ACTOR-A5",
      correlationId: "CORRELATION-A5",
    },
    workflowRevision: "mock-flow-v3",
    step: "verify",
    timestamp: "2026-09-05T00:00:00.000Z",
    outcome: "SUCCEEDED",
    details: { observed: { screen: "settings" } },
    ...overrides,
  };
}

describe("LocalEvidenceSink", () => {
  it("persists complete metadata and a verified SHA-256 artifact across instances", async () => {
    const root = await mkdtemp(join(tmpdir(), "iphone-fleet-evidence-"));
    roots.push(root);
    await new LocalEvidenceSink(root).append(record());

    const records = await new LocalEvidenceSink(root).listByJob("JOB-A5-001");
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      workflowRevision: "mock-flow-v3",
      step: "verify",
      outcome: "SUCCEEDED",
      artifactDigest: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
      context: {
        jobId: "JOB-A5-001",
        clientId: "CLIENT-A5",
        accountId: "ACCOUNT-A5",
        deviceId: "DEVICE-A5",
        networkAssignmentId: "NETWORK-A5",
        leaseId: "LEASE-A5",
        fencingToken: 7,
        actorId: "ACTOR-A5",
        correlationId: "CORRELATION-A5",
      },
    });
    const artifactPath = records[0]?.artifactPath;
    if (!artifactPath) throw new Error("artifact path missing");
    expect(await readFile(resolve(root, ...artifactPath.split("/")), "utf8")).toContain(
      '"screen": "settings"',
    );
  });

  it("fails closed when an artifact is corrupted", async () => {
    const root = await mkdtemp(join(tmpdir(), "iphone-fleet-evidence-"));
    roots.push(root);
    const sink = new LocalEvidenceSink(root);
    await sink.append(record());
    const [stored] = await sink.listByJob("JOB-A5-001");
    if (!stored?.artifactPath) throw new Error("artifact path missing");
    await writeFile(resolve(root, ...stored.artifactPath.split("/")), "tampered", "utf8");
    await expect(sink.listByJob("JOB-A5-001")).rejects.toThrow("digest mismatch");
  });

  it("rejects unsafe identifiers and caller-supplied digests", async () => {
    const root = await mkdtemp(join(tmpdir(), "iphone-fleet-evidence-"));
    roots.push(root);
    const sink = new LocalEvidenceSink(root);
    await expect(sink.append(record({ evidenceId: "../escape" }))).rejects.toThrow(
      "unsafe filesystem",
    );
    await expect(
      sink.append(record({ artifactPath: "forged", artifactDigest: "sha256:forged" })),
    ).rejects.toThrow("owned by LocalEvidenceSink");
  });

  it("records a successful Control Plane run as durable local evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "iphone-fleet-evidence-"));
    roots.push(root);
    const sink = new LocalEvidenceSink(root);
    const { controlPlane } = createMockFleetRuntime({ evidence: sink });
    const job = await controlPlane.submit({
      jobId: "JOB-A5-LOCAL",
      clientId: "CLIENT-DEMO",
      accountId: "ACCOUNT-DEMO-001",
      deviceId: "DEVICE-MOCK-001",
      networkAssignmentId: "NETWORK-DEMO-001",
      actorId: "A5-EVIDENCE",
      correlationId: "CORR-A5-LOCAL",
      action: { name: "set_state", parameters: { screen: "evidence" } },
      verification: { name: "state_contains", expected: { screen: "evidence" } },
      workflowRevision: "mock-a5-local",
    });
    expect(job.state).toBe("SUCCEEDED");
    await expect(new LocalEvidenceSink(root).listByJob("JOB-A5-LOCAL")).resolves.toEqual([
      expect.objectContaining({
        outcome: "SUCCEEDED",
        artifactDigest: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
      }),
    ]);
  });
});
