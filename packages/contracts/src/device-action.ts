import { z } from "zod";

export const DeviceActionSchema = z.strictObject({
  name: z.string().trim().min(1).max(200),
  parameters: z.record(z.string(), z.unknown()).default({}),
});

export const DeviceVerificationSchema = z.strictObject({
  name: z.string().trim().min(1).max(200),
  expected: z.unknown(),
});

export interface DeviceActionResult {
  readonly outcome: "SUCCEEDED" | "FAILED";
  readonly observed: unknown;
  readonly message?: string;
}

export interface DeviceVerificationResult {
  readonly verified: boolean;
  readonly observed: unknown;
  readonly message?: string;
}

export type DeviceAction = z.infer<typeof DeviceActionSchema>;
export type DeviceVerification = z.infer<typeof DeviceVerificationSchema>;
