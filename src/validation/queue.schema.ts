import { z } from 'zod';
import { Role } from '@prisma/client';

export const QueueFetchSchema = z.object({
  role: z.nativeEnum(Role, {
    message: "Validation Guard: Target role must map to a recognized institutional execution profile."
  }),
  departmentId: z.string().uuid().optional().or(z.literal(''))
});

export type QueueFetchInput = z.infer<typeof QueueFetchSchema>;