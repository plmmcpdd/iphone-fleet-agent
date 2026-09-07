import { createMockFleetRuntime } from "@iphone-fleet/control-plane";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";
import { createFleetMcpServer } from "../src/server.js";

const closeables: Array<{ close(): Promise<void> }> = [];
afterEach(async () => {
  await Promise.all(closeables.splice(0).map((value) => value.close()));
});

describe("Fleet MCP Contract v0.1", () => {
  it("exposes all seven Fleet tools with descriptions and schemas", async () => {
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
    for (const tool of tools.tools) {
      expect(tool.description?.length).toBeGreaterThan(40);
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.outputSchema).toMatchObject({ type: "object" });
    }
    const status = await client.callTool({ name: "fleet_status", arguments: {} });
    expect(status.structuredContent).toMatchObject({
      contractVersion: "0.1",
      runtime: "mock",
      ok: true,
      humanRequired: false,
      data: { status: { service: "iphone-fleet-agent" } },
    });

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
    expect(submitted.structuredContent).toMatchObject({
      ok: true,
      data: { job: { state: "SUCCEEDED" } },
    });

    const evidence = await client.callTool({
      name: "fleet_get_evidence",
      arguments: { jobId: "JOB-MCP-001" },
    });
    expect(evidence.structuredContent).toMatchObject({
      ok: true,
      data: { evidence: [expect.objectContaining({ outcome: "SUCCEEDED" })] },
    });
  });

  it("returns stable tool errors and explicit HUMAN_REQUIRED state", async () => {
    const { controlPlane } = createMockFleetRuntime();
    const server = createFleetMcpServer(controlPlane);
    const client = new Client({ name: "h0-contract-test", version: "0.1.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    closeables.push(client, server);
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const missing = await client.callTool({
      name: "fleet_get_job",
      arguments: { jobId: "JOB-MISSING" },
    });
    expect(missing.isError).toBe(true);
    const missingContent = missing.content[0];
    if (missingContent?.type !== "text") {
      throw new Error("Fleet MCP errors must include JSON TextContent");
    }
    expect(JSON.parse(missingContent.text)).toMatchObject({
      ok: false,
      error: { code: "JOB_NOT_FOUND", humanRequired: false },
    });

    await client.callTool({
      name: "fleet_submit_job",
      arguments: {
        jobId: "JOB-MCP-HUMAN",
        clientId: "CLIENT-DEMO",
        accountId: "ACCOUNT-DEMO-001",
        deviceId: "DEVICE-MOCK-001",
        networkAssignmentId: "NETWORK-DEMO-001",
        actorId: "mcp-test",
        correlationId: "CORR-MCP-HUMAN",
        actionName: "set_state",
        actionParameters: { screen: "settings" },
        verificationName: "state_contains",
        verificationExpected: { screen: "settings" },
        workflowRevision: "mock-v1",
      },
    });
    const human = await client.callTool({
      name: "fleet_request_human",
      arguments: { jobId: "JOB-MCP-HUMAN", reason: "Unlock the test device" },
    });
    expect(human.structuredContent).toMatchObject({
      ok: true,
      humanRequired: true,
      data: { job: { state: "NEEDS_HUMAN" } },
    });

    const wrongDevice = await client.callTool({
      name: "fleet_submit_job",
      arguments: {
        jobId: "JOB-MCP-WRONG-DEVICE",
        clientId: "CLIENT-DEMO",
        accountId: "ACCOUNT-DEMO-001",
        deviceId: "DEVICE-NOT-ASSIGNED",
        networkAssignmentId: "NETWORK-DEMO-001",
        actorId: "mcp-test",
        correlationId: "CORR-MCP-WRONG-DEVICE",
        actionName: "set_state",
        actionParameters: { screen: "unsafe" },
        verificationName: "state_contains",
        verificationExpected: { screen: "unsafe" },
        workflowRevision: "mock-v1",
      },
    });
    expect(wrongDevice.structuredContent).toMatchObject({
      ok: true,
      humanRequired: false,
      data: {
        job: { state: "FAILED", error: { code: "CONTEXT_MISMATCH" } },
      },
    });
  });
});
