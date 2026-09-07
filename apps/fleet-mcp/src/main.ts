import { createMa1MockFleetRuntime, createMockFleetRuntime } from "@iphone-fleet/control-plane";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createFleetMcpServer } from "./server.js";

const { controlPlane } =
  process.env.FLEET_MA1_RECORDED_FIXTURE === "1"
    ? createMa1MockFleetRuntime()
    : createMockFleetRuntime();
const server = createFleetMcpServer(controlPlane);
await server.connect(new StdioServerTransport());
