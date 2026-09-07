import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterEach, describe, expect, it } from "vitest";

const closeables: Array<{ close(): Promise<void> }> = [];
afterEach(async () => {
  await Promise.all(closeables.splice(0).map((value) => value.close()));
});

describe("Fleet MCP stdio black box", () => {
  it("discovers tools, completes a safe mock job, and retrieves its evidence", async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [fileURLToPath(new URL("../dist/main.js", import.meta.url))],
      cwd: fileURLToPath(new URL("../../..", import.meta.url)),
      stderr: "pipe",
    });
    const client = new Client({ name: "fleet-mcp-black-box", version: "0.1.0" });
    closeables.push(client);
    await client.connect(transport);

    const discovered = await client.listTools();
    expect(discovered.tools.map((tool) => tool.name)).toContain("fleet_submit_job");

    const jobId = `JOB-BLACK-BOX-${Date.now()}`;
    const submitted = await client.callTool({
      name: "fleet_submit_job",
      arguments: {
        jobId,
        clientId: "CLIENT-DEMO",
        accountId: "ACCOUNT-DEMO-001",
        deviceId: "DEVICE-MOCK-001",
        networkAssignmentId: "NETWORK-DEMO-001",
        actorId: "stdio-black-box",
        correlationId: `CORR-${jobId}`,
        actionName: "set_state",
        actionParameters: { screen: "settings" },
        verificationName: "state_contains",
        verificationExpected: { screen: "settings" },
        workflowRevision: "h0-mock-v1",
      },
    });
    expect(submitted.structuredContent).toMatchObject({
      runtime: "mock",
      ok: true,
      data: { job: { jobId, state: "SUCCEEDED" } },
    });

    const retrieved = await client.callTool({
      name: "fleet_get_job",
      arguments: { jobId },
    });
    expect(retrieved.structuredContent).toMatchObject({
      data: { job: { jobId, state: "SUCCEEDED" } },
    });

    const evidence = await client.callTool({
      name: "fleet_get_evidence",
      arguments: { jobId },
    });
    expect(evidence.structuredContent).toMatchObject({
      data: {
        evidence: [
          {
            context: {
              jobId,
              clientId: "CLIENT-DEMO",
              accountId: "ACCOUNT-DEMO-001",
              deviceId: "DEVICE-MOCK-001",
              networkAssignmentId: "NETWORK-DEMO-001",
              leaseId: expect.stringMatching(/^LEASE-/),
              fencingToken: expect.any(Number),
              actorId: "stdio-black-box",
              correlationId: `CORR-${jobId}`,
            },
            workflowRevision: "h0-mock-v1",
            step: "verify",
            timestamp: expect.any(String),
            outcome: "SUCCEEDED",
          },
        ],
      },
    });
  });
});
