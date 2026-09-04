#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { createMockFleetRuntime, type FleetControlPlane } from "@iphone-fleet/control-plane";

export async function runFleetCtl(
  args: readonly string[],
  controlPlane: FleetControlPlane,
  write: (value: string) => void = console.log,
): Promise<number> {
  const [command, ...rest] = args;
  const output = (value: unknown) => write(JSON.stringify(value, null, 2));

  switch (command) {
    case "status":
      output(await controlPlane.status());
      return 0;
    case "list-devices":
      output(await controlPlane.listDevices());
      return 0;
    case "find-device":
      output(
        await controlPlane.findDevice({
          clientId: rest[0] ?? "",
          accountId: rest[1] ?? "",
          networkAssignmentId: rest[2] ?? "",
        }),
      );
      return 0;
    case "get-job":
      output(controlPlane.getJob(rest[0] ?? ""));
      return 0;
    case "get-evidence":
      output(await controlPlane.getEvidence(rest[0] ?? ""));
      return 0;
    case "request-human":
      output(
        await controlPlane.requestHuman(rest[0] ?? "", rest.slice(1).join(" ") || "Manual review"),
      );
      return 0;
    case "demo": {
      const jobId = rest[0] ?? "JOB-DEMO-001";
      const job = await controlPlane.submit({
        jobId,
        clientId: "CLIENT-DEMO",
        accountId: "ACCOUNT-DEMO-001",
        deviceId: "DEVICE-MOCK-001",
        networkAssignmentId: "NETWORK-DEMO-001",
        actorId: "fleetctl",
        correlationId: `CORR-${jobId}`,
        action: { name: "set_state", parameters: { screen: "settings" } },
        verification: { name: "state_contains", expected: { screen: "settings" } },
        workflowRevision: "mock-v1",
      });
      output({ job, evidence: await controlPlane.getEvidence(jobId) });
      return job.state === "SUCCEEDED" ? 0 : 1;
    }
    default:
      write(
        "Usage: fleetctl <status|list-devices|find-device|get-job|get-evidence|request-human|demo>",
      );
      return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { controlPlane } = createMockFleetRuntime();
  process.exitCode = await runFleetCtl(process.argv.slice(2), controlPlane);
}
