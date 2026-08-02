// src/validation/check.schema.ts
import { z } from 'zod';

export const ReleaseCheckSchema = z.object({
  poId: z.string().uuid({
    message: "Audit Exception: The Purchase Order structural reference pointer must be a valid UUIDv4 layout."
  }),
  paymentType: z.enum(['CASH_CHECK', 'CREDIT_TERMS'], {
    message: "Validation Error: Payment type must be strictly bounded to 'CASH_CHECK' or 'CREDIT_TERMS'."
  }).default('CASH_CHECK'),
  checkNumber: z.string().optional()
}).superRefine((data, ctx) => {
  if (data.paymentType === 'CASH_CHECK' && (!data.checkNumber || data.checkNumber.trim().length < 4)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Format Discrepancy: Institutional check numbers must contain an auditable sequence of at least 4 characters.",
      path: ['checkNumber'],
    });
  }
});

export type ReleaseCheckInput = z.infer<typeof ReleaseCheckSchema>;