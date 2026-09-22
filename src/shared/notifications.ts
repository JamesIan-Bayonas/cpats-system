import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { EmailOutboxStatus, PRStatus, Role } from '@prisma/client';
import { prisma } from '@/shared/prisma';
import { getEmailDeliveryMode, sendEmail } from '@/shared/email';

const NOTIFICATION_TARGETS: Partial<Record<PRStatus, { role: Role; title: string; actionPath: string }>> = {
  [PRStatus.Pending_Business_Approval]: {
    role: Role.Business_Office,
    title: 'Purchase request awaiting budget review',
    actionPath: '/dashboard/pr/evaluate-business',
  },
  [PRStatus.Pending_Admin_Approval]: {
    role: Role.Admin_Office,
    title: 'Purchase request awaiting administrative approval',
    actionPath: '/dashboard/pr/approve-admin',
  },
  [PRStatus.Approved_Awaiting_PO]: {
    role: Role.Purchasing_Office,
    title: 'Approved request ready for PO preparation',
    actionPath: '/dashboard/po/new',
  },
  [PRStatus.Awaiting_Check_Issuance]: {
    role: Role.Business_Office,
    title: 'Purchase order awaiting check issuance',
    actionPath: '/dashboard/po/release-check',
  },
  [PRStatus.Ready_for_Purchase]: {
    role: Role.Receiving_Custodian,
    title: 'Purchase ready for receiving',
    actionPath: '/dashboard/receiving/new',
  },
  [PRStatus.Received_and_Closed]: {
    role: Role.Global_Auditor,
    title: 'Procurement transaction completed',
    actionPath: '/dashboard/audit',
  },
};

function hashVerificationCode(code: string): string {
  const secret = process.env.EMAIL_VERIFICATION_SECRET || process.env.SESSION_SECRET || 'cpats-development-verification-secret';
  return createHash('sha256').update(`${secret}:${code.toUpperCase()}`).digest('hex');
}

export function createVerificationCode(): { code: string; hash: string } {
  const code = randomBytes(4).toString('hex').toUpperCase();
  return { code, hash: hashVerificationCode(code) };
}

export function isVerificationCodeValid(code: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashVerificationCode(code), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function requestReference(prId: string): string {
  return `PR-${prId.slice(0, 8).toUpperCase()}`;
}

export async function processPendingEmailOutbox(limit = 10): Promise<void> {
  const now = new Date();
  const jobs = await prisma.emailOutbox.findMany({
    where: {
      status: { in: [EmailOutboxStatus.PENDING, EmailOutboxStatus.FAILED] },
      attempts: { lt: 3 },
      nextAttemptAt: { lte: now },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  for (const job of jobs) {
    try {
      await sendEmail({ to: job.recipientEmail, subject: job.subject, text: job.bodyText });
      await prisma.emailOutbox.update({
        where: { id: job.id },
        data: { status: EmailOutboxStatus.SENT, attempts: { increment: 1 }, sentAt: new Date(), lastError: null },
      });
    } catch (error) {
      const attempts = job.attempts + 1;
      await prisma.emailOutbox.update({
        where: { id: job.id },
        data: {
          status: EmailOutboxStatus.FAILED,
          attempts,
          lastError: error instanceof Error ? error.message.slice(0, 2000) : 'Unknown email delivery failure',
          nextAttemptAt: new Date(Date.now() + Math.min(attempts * 5, 30) * 60_000),
        },
      });
    }
  }
}

export async function dispatchNotificationForAuditLog(auditLogId: string): Promise<void> {
  try {
    const auditLog = await prisma.auditLog.findUnique({
      where: { id: auditLogId },
      include: { purchaseRequest: { include: { department: true } } },
    });
    if (!auditLog) return;

    const target = NOTIFICATION_TARGETS[auditLog.newState];
    if (!target || target.role === Role.Requesting_Office) return;

    const recipients = await prisma.user.findMany({
      where: { role: target.role },
      include: { notificationPreference: true },
    });
    const reference = requestReference(auditLog.prId);
    const message = `${reference} from ${auditLog.purchaseRequest.department.name} is now at ${auditLog.newState.replaceAll('_', ' ')}.`;

    for (const recipient of recipients) {
      const notification = await prisma.notification.upsert({
        where: { recipientId_sourceAuditLogId: { recipientId: recipient.id, sourceAuditLogId: auditLog.id } },
        update: {},
        create: {
          recipientId: recipient.id,
          prId: auditLog.prId,
          sourceAuditLogId: auditLog.id,
          title: target.title,
          message,
          actionPath: target.actionPath,
        },
      });

      const preference = recipient.notificationPreference;
      if (preference?.emailNotificationsEnabled && preference.notificationEmail && preference.emailVerifiedAt) {
        await prisma.emailOutbox.upsert({
          where: { notificationId: notification.id },
          update: {},
          create: {
            notificationId: notification.id,
            recipientEmail: preference.notificationEmail,
            subject: `[CPATS] ${target.title}`,
            bodyText: `${message}\n\nOpen CPATS: ${(process.env.APP_BASE_URL || 'http://localhost:3000')}${target.actionPath}`,
          },
        });
      }
    }

    await processPendingEmailOutbox();
  } catch (error) {
    console.error('Non-blocking notification dispatch failure:', error);
  }
}

export async function sendVerificationEmail(email: string, code: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: '[CPATS] Verify your notification email',
    text: `Your CPATS verification code is ${code}. It expires in 15 minutes. If you did not request this code, ignore this message.`,
  });
}

export function exposeDevelopmentVerificationCode(code: string): string | undefined {
  return getEmailDeliveryMode() === 'log' && process.env.NODE_ENV !== 'production' ? code : undefined;
}
