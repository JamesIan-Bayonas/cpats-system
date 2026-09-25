import { NextRequest, NextResponse } from 'next/server';
import { Role } from '@prisma/client';
import { prisma } from '@/shared/prisma';
import { authorizeRequest } from '@/shared/rbac';
import { ManageNotificationTrashSchema } from '@/validation/notification.schema';

const NOTIFIED_ROLES = Object.values(Role);
const MIN_RETENTION_DAYS = 7;
const MAX_RETENTION_DAYS = 60;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

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
    const purgeAfter = validation.data.retentionDays
      ? new Date(trashedAt.getTime() + validation.data.retentionDays * DAY_IN_MS)
      : new Date(validation.data.purgeAfter!);

    if (
      Number.isNaN(purgeAfter.getTime())
      || purgeAfter.getTime() < trashedAt.getTime() + MIN_RETENTION_DAYS * DAY_IN_MS
      || purgeAfter.getTime() > trashedAt.getTime() + MAX_RETENTION_DAYS * DAY_IN_MS
    ) {
      return NextResponse.json(
        { success: false, error: 'Choose a deletion date between 7 and 60 days from today.' },
        { status: 422 },
      );
    }
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
