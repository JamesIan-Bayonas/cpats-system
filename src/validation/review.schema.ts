// src/validation/review.schema.ts
import { z } from 'zod';

export const ReviewPRSchema = z.object({
  prId: z.string().uuid("Invalid format. Purchase request tracking identifier must be a valid UUIDv4."),
  action: z.enum(['SUBMIT', 'APPROVE', 'DECLINE', 'RETURN_FOR_CORRECTION'], {
    message: "Action must be strictly bounded to SUBMIT, APPROVE, DECLINE, or RETURN_FOR_CORRECTION."
  }),
  remarks: z.string().min(5, "Audit compliance requires remarks to be at least 5 characters long to preserve trail transparency."),
  adminProofFilePath: z.string().url("Invalid tracking link format.").optional()
});

export type ReviewPRInput = z.infer<typeof ReviewPRSchema>;