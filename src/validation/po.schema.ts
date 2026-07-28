// src/validation/po.schema.ts
import { z } from 'zod';

export const CreatePOSchema = z.object({
  purchaseRequestId: z.string().uuid({
    message: "Audit Exception: Purchase Request reference pointer must be a valid UUIDv4 layout."
  }),
  poNumber: z.string().min(5, {
    message: "Format Discrepancy: Purchase Order numbers must contain a descriptive sequence of at least 5 characters."
  }),
  paymentType: z.enum(['CASH_CHECK', 'CREDIT_TERMS'], {
    message: "Validation Error: Payment type must be strictly bounded to 'CASH_CHECK' or 'CREDIT_TERMS'."
  }).default('CASH_CHECK')
});

export type CreatePOInput = z.infer<typeof CreatePOSchema>;