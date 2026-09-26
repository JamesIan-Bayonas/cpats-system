import { z } from 'zod';

export const NotificationListSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  view: z.enum(['inbox', 'archive', 'trash']).default('inbox'),
});

export const MarkNotificationReadSchema = z.union([
  z.object({ notificationId: z.string().uuid(), all: z.never().optional() }),
  z.object({ all: z.literal(true), notificationId: z.never().optional() }),
]);

const NotificationIdsSchema = z.array(z.string().uuid()).min(1).max(100);
export const ManageNotificationInboxSchema = z.object({
  action: z.enum(['archive', 'unarchive', 'markRead', 'markUnread']),
  notificationIds: NotificationIdsSchema,
});
const RetentionDaysSchema = z.union([z.literal(7), z.literal(14), z.literal(60)]);
const CustomPurgeAfterSchema = z.string().datetime({ offset: true });

const MoveNotificationToTrashSchema = z.object({
  action: z.literal('move'),
  notificationIds: NotificationIdsSchema,
  retentionDays: RetentionDaysSchema.optional(),
  purgeAfter: CustomPurgeAfterSchema.optional(),
}).refine(
  (value) => (value.retentionDays ? 1 : 0) + (value.purgeAfter ? 1 : 0) === 1,
  { message: 'Choose one retention period or a custom deletion date.' },
);

export const ManageNotificationTrashSchema = z.discriminatedUnion('action', [
  MoveNotificationToTrashSchema,
  z.object({ action: z.literal('restore'), notificationIds: NotificationIdsSchema }),
  z.object({ action: z.literal('deletePermanently'), notificationIds: NotificationIdsSchema }),
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
