import { createMockFleetRuntime } from "@iphone-fleet/control-plane";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createFleetMcpServer } from "./server.js";

const { controlPlane } = createMockFleetRuntime();
const server = createFleetMcpServer(controlPlane);
await server.connect(new StdioServerTransport());
