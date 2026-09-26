import { NextRequest, NextResponse } from 'next/server';
import { Prisma, Role } from '@prisma/client';
import { prisma } from '@/shared/prisma';
import { authorizeRequest } from '@/shared/rbac';
import { ManageNotificationInboxSchema } from '@/validation/notification.schema';

const NOTIFIED_ROLES = Object.values(Role);

export async function POST(request: NextRequest) {
  const auth = await authorizeRequest(request, NOTIFIED_ROLES);
  if (!auth.success) return auth.response;

  const validation = ManageNotificationInboxSchema.safeParse(await request.json());
  if (!validation.success) return NextResponse.json({ success: false, errors: validation.error.format() }, { status: 422 });

  const { action, notificationIds } = validation.data;
  const commonWhere = { id: { in: notificationIds }, recipientId: auth.user.id, trashedAt: null };
  const where: Prisma.NotificationWhereInput = action === 'archive' ? { ...commonWhere, archivedAt: null }
    : action === 'unarchive' ? { ...commonWhere, archivedAt: { not: null } }
    : action === 'markRead' ? { ...commonWhere, readAt: null }
    : { ...commonWhere, readAt: { not: null } };
  const data: Prisma.NotificationUpdateManyMutationInput = action === 'archive' ? { archivedAt: new Date() }
    : action === 'unarchive' ? { archivedAt: null }
    : action === 'markRead' ? { readAt: new Date() }
    : { readAt: null };
  const result = await prisma.notification.updateMany({ where, data });

  return NextResponse.json({ success: true, data: { updated: result.count } });
}
