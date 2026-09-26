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

const REQUESTER_UPDATES: Partial<Record<PRStatus, { title: string; description: string }>> = {
  [PRStatus.Pending_Admin_Approval]: {
    title: 'Business Office accepted your request',
    description: 'The Business Office accepted your request and forwarded it to the Admin Office for approval.',
  },
  [PRStatus.Approved_Awaiting_PO]: {
    title: 'Admin Office approved your request',
    description: 'The Admin Office approved your request. The Purchasing Office will prepare the purchase order.',
  },
  [PRStatus.Awaiting_Check_Issuance]: {
    title: 'Purchase order prepared for your request',
    description: 'The Purchasing Office prepared the purchase order and sent it to the Business Office for payment processing.',
  },
  [PRStatus.Ready_for_Purchase]: {
    title: 'Your purchase is ready for receiving',
    description: 'Payment processing is complete. The purchase is ready for the Receiving Custodian.',
  },
  [PRStatus.Received_and_Closed]: {
    title: 'Your request is complete',
    description: 'The purchase has been received and the request is closed.',
  },
};

function requestingOfficeUpdate(status: PRStatus, actorRole: Role): { title: string; description: string } | undefined {
  if (status === PRStatus.Declined) {
    const office = actorRole === Role.Admin_Office ? 'Admin Office' : 'Business Office';
    return { title: `${office} declined your request`, description: `The ${office} declined your request. Open Track Requests to review the decision and remarks.` };
  }
  if (status === PRStatus.Returned_for_Correction) {
    const office = actorRole === Role.Admin_Office ? 'Admin Office' : 'Business Office';
    return actorRole === Role.Admin_Office
      ? { title: 'Admin Office returned your request for revision', description: 'The Admin Office returned your request. Open Track Requests to review the remarks and modify the saved request without entering its details again.' }
      : { title: `${office} returned your request for revision`, description: `The ${office} returned your request for revision. Open Track Requests to review the remarks and correct it.` };
  }
  return REQUESTER_UPDATES[status];
}

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
      include: { actor: { select: { role: true } }, purchaseRequest: { include: { department: true } } },
    });
    if (!auditLog) return;

    const target = NOTIFICATION_TARGETS[auditLog.newState];
    const requesterUpdate = auditLog.actor.role === Role.Requesting_Office
      ? undefined
      : auditLog.actor.role === Role.Business_Office &&
          auditLog.previousState === PRStatus.Returned_for_Correction &&
          auditLog.newState === PRStatus.Pending_Admin_Approval
        ? { title: 'Business Office resubmitted your request', description: 'The Business Office revised its fiscal evaluation and sent the same request back to Admin for approval.' }
        : requestingOfficeUpdate(auditLog.newState, auditLog.actor.role);
    const businessUpdate = auditLog.actor.role === Role.Admin_Office &&
      (auditLog.newState === PRStatus.Returned_for_Correction || auditLog.newState === PRStatus.Declined)
      ? {
          title: auditLog.newState === PRStatus.Returned_for_Correction ? 'Admin returned your evaluation for revision' : 'Admin declined a request you evaluated',
          actionPath: '/dashboard/pr/evaluate-business',
        }
      : undefined;
    if (!target && !requesterUpdate && !businessUpdate) return;

    const recipients = await prisma.user.findMany({
      where: {
        OR: [
          ...(target ? [{ role: target.role }] : []),
          ...(requesterUpdate ? [{ role: Role.Requesting_Office, departmentId: auditLog.purchaseRequest.departmentId }] : []),
          ...(businessUpdate ? [{ role: Role.Business_Office }] : []),
        ],
      },
      include: { notificationPreference: true },
    });
    const reference = requestReference(auditLog.prId);

    for (const recipient of recipients) {
      const recipientTarget = recipient.role === Role.Requesting_Office
        ? requesterUpdate && { title: requesterUpdate.title, actionPath: `/dashboard/pr/track?prId=${auditLog.prId}&auditLogId=${auditLog.id}` }
        : businessUpdate && recipient.role === Role.Business_Office ? businessUpdate
        : target && recipient.role === target.role ? target : undefined;
      if (!recipientTarget) continue;
      const actionPath = recipient.role === Role.Requesting_Office
        ? recipientTarget.actionPath
        : `${recipientTarget.actionPath}?prId=${auditLog.prId}${recipient.role === Role.Global_Auditor ? `&auditLogId=${auditLog.id}` : ''}`;
      const message = recipient.role === Role.Requesting_Office && requesterUpdate
        ? `${reference}: ${requesterUpdate.description}`
        : recipient.role === Role.Business_Office && businessUpdate
        ? `${reference}: The Admin Office ${auditLog.newState === PRStatus.Returned_for_Correction ? 'returned this request for fiscal revision. Open the Business Office queue to review the remarks and resubmit.' : 'declined this request. Open decision history to review the reason.'}`
        : `${reference} from ${auditLog.purchaseRequest.department.name} is now at ${auditLog.newState.replaceAll('_', ' ')}.`;
      const notification = await prisma.notification.upsert({
        where: { recipientId_sourceAuditLogId: { recipientId: recipient.id, sourceAuditLogId: auditLog.id } },
        update: {},
        create: {
          recipientId: recipient.id,
          prId: auditLog.prId,
          sourceAuditLogId: auditLog.id,
          title: recipientTarget.title,
          message,
          actionPath,
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
            subject: `[CPATS] ${recipientTarget.title}`,
            bodyText: `${message}\n\nOpen CPATS: ${(process.env.APP_BASE_URL || 'http://localhost:3000')}${actionPath}`,
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
