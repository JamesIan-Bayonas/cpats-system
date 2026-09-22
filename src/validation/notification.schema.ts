import { z } from 'zod';

export const NotificationListSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const MarkNotificationReadSchema = z.union([
  z.object({ notificationId: z.string().uuid(), all: z.never().optional() }),
  z.object({ all: z.literal(true), notificationId: z.never().optional() }),
]);

export const RequestEmailVerificationSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
});

export const VerifyEmailSchema = z.object({
  code: z.string().trim().regex(/^[A-F0-9]{8}$/i, 'Enter the 8-character verification code.'),
});

export const UpdateNotificationSettingsSchema = z.object({
  emailNotificationsEnabled: z.boolean().optional(),
  unlink: z.boolean().optional(),
}).refine(
  (value) => value.emailNotificationsEnabled !== undefined || value.unlink === true,
  { message: 'No notification setting change was supplied.' }
);
