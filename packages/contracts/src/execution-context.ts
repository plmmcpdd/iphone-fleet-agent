import { z } from "zod";
import {
  AccountIdSchema,
  ActorIdSchema,
  ClientIdSchema,
  CorrelationIdSchema,
  DeviceIdSchema,
  JobIdSchema,
  LeaseIdSchema,
  NetworkAssignmentIdSchema,
} from "./ids.js";

export const ExecutionContextSchema = z.strictObject({
  jobId: JobIdSchema,
  clientId: ClientIdSchema,
  accountId: AccountIdSchema,
  deviceId: DeviceIdSchema,
  networkAssignmentId: NetworkAssignmentIdSchema,
  leaseId: LeaseIdSchema,
  fencingToken: z.number().int().positive(),
  actorId: ActorIdSchema,
  correlationId: CorrelationIdSchema,
});

export type ExecutionContext = z.infer<typeof ExecutionContextSchema>;

export function parseExecutionContext(input: unknown): ExecutionContext {
  return ExecutionContextSchema.parse(input);
}
