import type { FleetControlPlane } from "@iphone-fleet/control-plane";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const textResult = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value) }],
});

export function createFleetMcpServer(controlPlane: FleetControlPlane): McpServer {
  const server = new McpServer({ name: "iphone-fleet-agent", version: "0.1.0-draft" });

  server.registerTool(
    "fleet_status",
    { description: "Return mock fleet control-plane status" },
    async () => textResult(await controlPlane.status()),
  );
  server.registerTool("fleet_list_devices", { description: "List known devices" }, async () =>
    textResult(await controlPlane.listDevices()),
  );
  server.registerTool(
    "fleet_find_device",
    {
      description: "Find the explicitly assigned device for a client/account/network context",
      inputSchema: {
        clientId: z.string().min(1),
        accountId: z.string().min(1),
        networkAssignmentId: z.string().min(1),
      },
    },
    async (input) => textResult(await controlPlane.findDevice(input)),
  );
  server.registerTool(
    "fleet_submit_job",
    {
      description: "Submit and execute one mock device job (MCP Contract v0.1-draft)",
      inputSchema: {
        jobId: z.string().min(1),
        clientId: z.string().min(1),
        accountId: z.string().min(1),
        deviceId: z.string().min(1),
        networkAssignmentId: z.string().min(1),
        actorId: z.string().min(1),
        correlationId: z.string().min(1),
        actionName: z.string().min(1),
        actionParameters: z.record(z.string(), z.unknown()).default({}),
        verificationName: z.string().min(1),
        verificationExpected: z.unknown(),
        workflowRevision: z.string().min(1),
      },
    },
    async (input) =>
      textResult(
        await controlPlane.submit({
          jobId: input.jobId,
          clientId: input.clientId,
          accountId: input.accountId,
          deviceId: input.deviceId,
          networkAssignmentId: input.networkAssignmentId,
          actorId: input.actorId,
          correlationId: input.correlationId,
          action: { name: input.actionName, parameters: input.actionParameters },
          verification: { name: input.verificationName, expected: input.verificationExpected },
          workflowRevision: input.workflowRevision,
        }),
      ),
  );
  server.registerTool(
    "fleet_get_job",
    { description: "Get a job by id", inputSchema: { jobId: z.string().min(1) } },
    async ({ jobId }) => textResult(controlPlane.getJob(jobId)),
  );
  server.registerTool(
    "fleet_get_evidence",
    { description: "List evidence for a job", inputSchema: { jobId: z.string().min(1) } },
    async ({ jobId }) => textResult(await controlPlane.getEvidence(jobId)),
  );
  server.registerTool(
    "fleet_request_human",
    {
      description: "Move a runnable job to NEEDS_HUMAN with evidence",
      inputSchema: { jobId: z.string().min(1), reason: z.string().min(1) },
    },
    async ({ jobId, reason }) => textResult(await controlPlane.requestHuman(jobId, reason)),
  );
  return server;
}
