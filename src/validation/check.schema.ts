// src/validation/check.schema.ts
import { z } from 'zod';

export const ReleaseCheckSchema = z.object({
  poId: z.string().uuid({
    message: "Audit Exception: The Purchase Order structural reference pointer must be a valid UUIDv4 layout."
  }),
  checkNumber: z.string().min(4, {
    message: "Format Discrepancy: Institutional check numbers must contain an auditable sequence of at least 4 characters."
  })
});

export type ReleaseCheckInput = z.infer<typeof ReleaseCheckSchema>;