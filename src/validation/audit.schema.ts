// src/validation/audit.schema.ts
import { z } from 'zod';
import { PRStatus } from '@prisma/client';

export const AuditFilterSchema = z.object({
  departmentId: z.string().uuid().optional().or(z.literal('')),
  status: z.nativeEnum(PRStatus).optional().or(z.literal('')),
  dateFrom: z.string().datetime().optional().or(z.literal('')),
  dateTo: z.string().datetime().optional().or(z.literal('')),
  sortField: z.enum(['createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type AuditFilterInput = z.infer<typeof AuditFilterSchema>;