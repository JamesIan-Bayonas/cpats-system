// src/validation/receiving.schema.ts
import { z } from 'zod';

export const CreateReceivingReportSchema = z.object({
  purchaseOrderId: z.string().uuid({
    message: "Audit Exception: The Purchase Order reference pointer must be a valid UUIDv4 layout."
  }),
  condition: z.enum(['Good', 'Damaged'], {
    message: "Validation Error: Asset condition evaluation must be strictly bounded to 'Good' or 'Damaged'."
  }),
  invoiceFilePath: z.string().min(2, {
    message: "Compliance Exception: A valid file path link for the supplier's invoice payload must be declared."
  }),
  asssetImageFilePath: z.string().min(2, {
    message: "Compliance Exception: A valid storage path link for the physical hardware photographic record is mandatory."
  }),
  remarks: z.string().optional()
});

export type CreateReceivingReportInput = z.infer<typeof CreateReceivingReportSchema>;