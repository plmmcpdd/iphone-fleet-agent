import type { FleetControlPlane } from "@iphone-fleet/control-plane";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const contractVersion = "0.1" as const;
const runtimeMode = "mock" as const;

const outputSchema = {
  contractVersion: z.literal(contractVersion).describe("Fleet MCP contract version"),
  runtime: z.literal(runtimeMode).describe("Current server runtime; mock never means real iOS"),
  ok: z.literal(true),
  humanRequired: z.boolean().describe("True only when the returned job needs a human action"),
  data: z.record(z.string(), z.unknown()).describe("Tool-specific structured result"),
};

const retryableCodes = new Set(["DEVICE_ALREADY_LEASED", "DEVICE_OFFLINE", "LEASE_EXPIRED"]);

function success(data: Record<string, unknown>, humanRequired = false) {
  const payload = { contractVersion, runtime: runtimeMode, ok: true as const, humanRequired, data };
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload) }],
    structuredContent: payload,
  };
}

function failure(error: unknown) {
  const candidate = error as { code?: unknown; message?: unknown };
  const code = typeof candidate?.code === "string" ? candidate.code : "INTERNAL_ERROR";
  const message =
    typeof candidate?.message === "string" ? candidate.message : "Fleet MCP tool execution failed";
  const payload = {
    contractVersion,
    runtime: runtimeMode,
    ok: false as const,
    error: {
      code,
      message,
      retryable: retryableCodes.has(code),
      humanRequired: code === "HUMAN_REQUIRED",
    },
  };
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload) }],
    isError: true as const,
  };
}

async function safely(
  operation: () => Promise<ReturnType<typeof success>> | ReturnType<typeof success>,
) {
  try {
    return await operation();
  } catch (error) {
    return failure(error);
  }
}

function notFound(code: string, message: string): never {
  throw Object.assign(new Error(message), { code });
}

export function createFleetMcpServer(controlPlane: FleetControlPlane): McpServer {
  const server = new McpServer({ name: "iphone-fleet-agent", version: "0.1.0" });

  server.registerTool(
    "fleet_status",
    {
      description:
        "Inspect Fleet service health, device count, job counts, contract version, and runtime mode. This is read-only; runtime=mock is not real-iOS validation.",
      outputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async () => safely(async () => success({ status: await controlPlane.status() })),
  );
  server.registerTool(
    "fleet_list_devices",
    {
      description:
        "List Fleet devices and their explicit client/account/network assignments. Read-only; use the returned deviceId rather than guessing one.",
      outputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async () => safely(async () => success({ devices: await controlPlane.listDevices() })),
  );
  server.registerTool(
    "fleet_find_device",
    {
      description:
        "Resolve the device whose clientId, accountId, and networkAssignmentId all match. Returns device=null when no exact assignment exists; never substitute another device.",
      inputSchema: {
        clientId: z.string().trim().min(1).describe("Owning Fleet client identifier"),
        accountId: z.string().trim().min(1).describe("Account that must be assigned to the device"),
        networkAssignmentId: z
          .string()
          .trim()
          .min(1)
          .describe("Network assignment that must match both account and device"),
      },
      outputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) =>
      safely(async () => success({ device: (await controlPlane.findDevice(input)) ?? null })),
  );
  server.registerTool(
    "fleet_submit_job",
    {
      description:
        "Submit one governed device job. All client/account/device/network identifiers are mandatory and must match; Fleet enforces policy, lease/fencing, verification, and evidence. A completed tool call can still return job.state=FAILED; success requires SUCCEEDED plus matching evidence. The H0 local server executes only the allow-listed mock set_state action.",
      inputSchema: {
        jobId: z.string().trim().min(1).describe("Caller-generated unique job identifier"),
        clientId: z.string().trim().min(1).describe("Owning Fleet client identifier"),
        accountId: z.string().trim().min(1).describe("Account bound to this job"),
        deviceId: z
          .string()
          .trim()
          .min(1)
          .describe("Explicit device to operate; never omit or infer"),
        networkAssignmentId: z
          .string()
          .trim()
          .min(1)
          .describe("Network assignment expected for the account and device"),
        actorId: z.string().trim().min(1).describe("Human or harness actor initiating the job"),
        correlationId: z.string().trim().min(1).describe("End-to-end trace correlation identifier"),
        actionName: z
          .string()
          .trim()
          .min(1)
          .describe("Device action name; H0 mock allows set_state"),
        actionParameters: z
          .record(z.string(), z.unknown())
          .default({})
          .describe("Action-specific parameters"),
        verificationName: z
          .string()
          .trim()
          .min(1)
          .describe("Postcondition verifier; H0 mock supports state_contains"),
        verificationExpected: z.unknown().describe("Expected postcondition value"),
        workflowRevision: z.string().trim().min(1).describe("Version of the workflow or flow"),
      },
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async (input) =>
      safely(async () => {
        const job = await controlPlane.submit({
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
        });
        return success({ job }, job.state === "NEEDS_HUMAN");
      }),
  );
  server.registerTool(
    "fleet_get_job",
    {
      description:
        "Retrieve a Fleet job by jobId, including terminal state, explicit execution context, and stable Fleet error code when failed.",
      inputSchema: { jobId: z.string().trim().min(1).describe("Fleet job identifier") },
      outputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async ({ jobId }) =>
      safely(() => {
        const job = controlPlane.getJob(jobId);
        if (!job) notFound("JOB_NOT_FOUND", `Job ${jobId} was not found`);
        return success({ job }, job.state === "NEEDS_HUMAN");
      }),
  );
  server.registerTool(
    "fleet_get_evidence",
    {
      description:
        "Retrieve audit evidence for a job. Each record carries full execution context, workflow revision, step, timestamp, outcome, and optional artifact digest/path. An empty list is not proof of success.",
      inputSchema: { jobId: z.string().trim().min(1).describe("Fleet job identifier") },
      outputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async ({ jobId }) =>
      safely(async () => success({ evidence: await controlPlane.getEvidence(jobId) })),
  );
  server.registerTool(
    "fleet_request_human",
    {
      description:
        "Put an existing runnable job into NEEDS_HUMAN and append evidence explaining the single concrete human intervention required. This does not bypass policy or resume execution.",
      inputSchema: {
        jobId: z.string().trim().min(1).describe("Fleet job identifier"),
        reason: z.string().trim().min(1).describe("Concrete reason a human action is required"),
      },
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ jobId, reason }) =>
      safely(async () => success({ job: await controlPlane.requestHuman(jobId, reason) }, true)),
  );
  return server;
}
