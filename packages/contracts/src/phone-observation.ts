import { z } from "zod";

export const PhoneObservationSchema = z.strictObject({
  screenshotRef: z.string().trim().min(1),
  screen: z.strictObject({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  foregroundApp: z.string().trim().min(1),
  observedAt: z.string().datetime(),
  elements: z
    .array(
      z.strictObject({
        role: z.string().trim().min(1),
        label: z.string().trim().min(1).optional(),
        bounds: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
      }),
    )
    .optional(),
});

export type PhoneObservation = z.infer<typeof PhoneObservationSchema>;
