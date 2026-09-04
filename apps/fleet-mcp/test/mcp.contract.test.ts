import { createMockFleetRuntime } from "@iphone-fleet/control-plane";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";
import { createFleetMcpServer } from "../src/server.js";

const closeables: Array<{ close(): Promise<void> }> = [];
afterEach(async () => {
  await Promise.all(closeables.splice(0).map((value) => value.close()));
});

describe("MCP Contract v0.1-draft", () => {
  it("exposes all seven draft Fleet tools over the official MCP transport", async () => {
    const { controlPlane } = createMockFleetRuntime();
    const server = createFleetMcpServer(controlPlane);
    const client = new Client({ name: "a2-contract-test", version: "0.1.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    closeables.push(client, server);
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name).sort()).toEqual(
      [
        "fleet_status",
        "fleet_list_devices",
        "fleet_find_device",
        "fleet_submit_job",
        "fleet_get_job",
        "fleet_get_evidence",
        "fleet_request_human",
      ].sort(),
    );
    const status = await client.callTool({ name: "fleet_status", arguments: {} });
    expect(JSON.stringify(status.content)).toContain("MCP Contract v0.1-draft");

    const submitted = await client.callTool({
      name: "fleet_submit_job",
      arguments: {
        jobId: "JOB-MCP-001",
        clientId: "CLIENT-DEMO",
        accountId: "ACCOUNT-DEMO-001",
        deviceId: "DEVICE-MOCK-001",
        networkAssignmentId: "NETWORK-DEMO-001",
        actorId: "mcp-test",
        correlationId: "CORR-MCP-001",
        actionName: "set_state",
        actionParameters: { screen: "settings" },
        verificationName: "state_contains",
        verificationExpected: { screen: "settings" },
        workflowRevision: "mock-v1",
      },
    });
    const submittedContent = submitted.content[0];
    if (submittedContent?.type !== "text") {
      throw new Error("fleet_submit_job must return MCP TextContent");
    }
    expect(JSON.parse(submittedContent.text)).toMatchObject({ state: "SUCCEEDED" });

    const evidence = await client.callTool({
      name: "fleet_get_evidence",
      arguments: { jobId: "JOB-MCP-001" },
    });
    const evidenceContent = evidence.content[0];
    if (evidenceContent?.type !== "text") {
      throw new Error("fleet_get_evidence must return MCP TextContent");
    }
    expect(JSON.parse(evidenceContent.text)).toEqual([
      expect.objectContaining({ outcome: "SUCCEEDED" }),
    ]);
  });
});
