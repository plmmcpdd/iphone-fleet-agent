import { z } from "zod";

const identifier = (label: string) =>
  z
    .string({ error: `${label} must be a string` })
    .trim()
    .min(1, `${label} is required`)
    .max(200, `${label} is too long`);

export const JobIdSchema = identifier("jobId");
export const ClientIdSchema = identifier("clientId");
export const AccountIdSchema = identifier("accountId");
export const DeviceIdSchema = identifier("deviceId");
export const NetworkAssignmentIdSchema = identifier("networkAssignmentId");
export const LeaseIdSchema = identifier("leaseId");
export const ActorIdSchema = identifier("actorId");
export const CorrelationIdSchema = identifier("correlationId");

export type JobId = z.infer<typeof JobIdSchema>;
export type ClientId = z.infer<typeof ClientIdSchema>;
export type AccountId = z.infer<typeof AccountIdSchema>;
export type DeviceId = z.infer<typeof DeviceIdSchema>;
export type NetworkAssignmentId = z.infer<typeof NetworkAssignmentIdSchema>;
export type LeaseId = z.infer<typeof LeaseIdSchema>;
export type ActorId = z.infer<typeof ActorIdSchema>;
export type CorrelationId = z.infer<typeof CorrelationIdSchema>;
