import { NextRequest, NextResponse } from 'next/server';
import { Role } from '@prisma/client';
import { prisma } from '@/shared/prisma';
import { authorizeRequest } from '@/shared/rbac';
import { NotificationListSchema } from '@/validation/notification.schema';

const NOTIFIED_ROLES = [Role.Business_Office, Role.Admin_Office, Role.Purchasing_Office, Role.Receiving_Custodian, Role.Global_Auditor];

export async function GET(request: NextRequest) {
  const auth = await authorizeRequest(request, NOTIFIED_ROLES);
  if (!auth.success) return auth.response;

  const validation = NotificationListSchema.safeParse({ limit: request.nextUrl.searchParams.get('limit') || undefined });
  if (!validation.success) return NextResponse.json({ success: false, errors: validation.error.format() }, { status: 422 });

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { recipientId: auth.user.id },
      orderBy: { createdAt: 'desc' },
      take: validation.data.limit,
      select: { id: true, title: true, message: true, actionPath: true, readAt: true, createdAt: true },
    }),
    prisma.notification.count({ where: { recipientId: auth.user.id, readAt: null } }),
  ]);

  return NextResponse.json({ success: true, data: { notifications, unreadCount } });
}
