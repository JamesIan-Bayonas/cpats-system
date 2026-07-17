import { z } from 'zod';

export const ReviewPRSchema = z.object({
  prId: z.string().uuid({ message: "Target purchase request identifier must be a valid UUIDv4 string." }),
  action: z.enum(['SUBMIT', 'APPROVE', 'DECLINE', 'RETURN_FOR_CORRECTION'], {
    errorMap: () => ({ message: "Invalid workflow mutation vector specified." })
  }),
  remarks: z.string().min(10, { 
    message: "Audit trace compliance requires an explanatory remark of at least 10 characters." 
  }),
  adminProofFilePath: z.string().url({ message: "Proof of physical authorization must be a valid file storage URI path." }).optional()
});

export type ReviewPRInput = z.infer<typeof ReviewPRSchema>;