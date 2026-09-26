import { NextRequest, NextResponse } from 'next/server';
import { Role } from '@prisma/client';
import { prisma } from '@/shared/prisma';
import { authorizeRequest } from '@/shared/rbac';
import { MarkNotificationReadSchema } from '@/validation/notification.schema';

const NOTIFIED_ROLES = Object.values(Role);

export async function POST(request: NextRequest) {
  const auth = await authorizeRequest(request, NOTIFIED_ROLES);
  if (!auth.success) return auth.response;
  const validation = MarkNotificationReadSchema.safeParse(await request.json());
  if (!validation.success) return NextResponse.json({ success: false, errors: validation.error.format() }, { status: 422 });

  const result = await prisma.notification.updateMany({
    where: validation.data.all
      ? { recipientId: auth.user.id, readAt: null, archivedAt: null, trashedAt: null }
      : { id: validation.data.notificationId, recipientId: auth.user.id, readAt: null, trashedAt: null },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ success: true, data: { updated: result.count } });
}
