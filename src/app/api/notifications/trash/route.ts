import { NextRequest, NextResponse } from 'next/server';
import { Role } from '@prisma/client';
import { prisma } from '@/shared/prisma';
import { authorizeRequest } from '@/shared/rbac';
import { ManageNotificationTrashSchema } from '@/validation/notification.schema';

const NOTIFIED_ROLES = [Role.Business_Office, Role.Admin_Office, Role.Purchasing_Office, Role.Receiving_Custodian, Role.Global_Auditor];

export async function POST(request: NextRequest) {
  const auth = await authorizeRequest(request, NOTIFIED_ROLES);
  if (!auth.success) return auth.response;

  const validation = ManageNotificationTrashSchema.safeParse(await request.json());
  if (!validation.success) {
    return NextResponse.json({ success: false, errors: validation.error.format() }, { status: 422 });
  }

  const { action, notificationIds } = validation.data;
  if (action === 'move') {
    const trashedAt = new Date();
    const purgeAfter = new Date(trashedAt.getTime() + validation.data.retentionDays * 24 * 60 * 60 * 1000);
    const result = await prisma.notification.updateMany({
      where: { id: { in: notificationIds }, recipientId: auth.user.id, trashedAt: null },
      data: { trashedAt, purgeAfter, readAt: trashedAt },
    });
    return NextResponse.json({ success: true, data: { updated: result.count, purgeAfter } });
  }

  if (action === 'restore') {
    const result = await prisma.notification.updateMany({
      where: { id: { in: notificationIds }, recipientId: auth.user.id, trashedAt: { not: null } },
      data: { trashedAt: null, purgeAfter: null },
    });
    return NextResponse.json({ success: true, data: { updated: result.count } });
  }

  const result = await prisma.notification.deleteMany({
    where: { id: { in: notificationIds }, recipientId: auth.user.id, trashedAt: { not: null } },
  });
  return NextResponse.json({ success: true, data: { deleted: result.count } });
}
