// src/validation/pr.schema.ts
import { z } from 'zod';

// Validate individual item lines inside the request payload
const PurchaseItemSchema = z.object({
  itemName: z.string().min(2, "Item name must be descriptive."),
  quantity: z.number().int().positive("Quantity must be a positive integer."),
  unitPrice: z.number().positive("Unit price must be greater than zero.").optional(),
});

// The master schema for creating a new Purchase Request
export const CreatePRSchema = z.object({
  justification: z.string().min(10, "Please provide a more robust justification note."),
  isDirectPoBypass: z.boolean().default(false),
  adminProofFilePath: z.string().optional(),
  items: z.array(PurchaseItemSchema).min(1, "A purchase request must contain at least one item."),
}).superRefine((data, ctx) => {
  if (data.isDirectPoBypass && (!data.adminProofFilePath || data.adminProofFilePath.trim().length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Compliance Exception: Uploading or attaching the officially signed executive approval letter is mandatory when enabling the direct PO bypass.",
      path: ['adminProofFilePath'],
    });
  }
});

export type CreatePRInput = z.infer<typeof CreatePRSchema>;