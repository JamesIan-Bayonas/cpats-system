// src/validation/po.schema.ts
import { z } from 'zod';

export const CreatePOSchema = z.object({
  purchaseRequestId: z.string().uuid({
    message: "Audit Exception: Purchase Request reference pointer must be a valid UUIDv4 layout."
  }),
  poNumber: z.string().min(5, {
    message: "Format Discrepancy: Purchase Order numbers must contain a descriptive sequence of at least 5 characters."
  })
});

export type CreatePOInput = z.infer<typeof CreatePOSchema>;