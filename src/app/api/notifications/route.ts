import { NextRequest, NextResponse } from 'next/server';
import { Role } from '@prisma/client';
import { prisma } from '@/shared/prisma';
import { authorizeRequest } from '@/shared/rbac';
import { NotificationListSchema } from '@/validation/notification.schema';

const NOTIFIED_ROLES = Object.values(Role);

export async function GET(request: NextRequest) {
  const auth = await authorizeRequest(request, NOTIFIED_ROLES);
  if (!auth.success) return auth.response;

  const validation = NotificationListSchema.safeParse({
    limit: request.nextUrl.searchParams.get('limit') || undefined,
    view: request.nextUrl.searchParams.get('view') || undefined,
  });
  if (!validation.success) return NextResponse.json({ success: false, errors: validation.error.format() }, { status: 422 });

  await prisma.notification.deleteMany({
    where: { recipientId: auth.user.id, trashedAt: { not: null }, purgeAfter: { lte: new Date() } },
  });

  const view = validation.data.view;
  const [notifications, unreadCount, trashCount, archiveCount] = await Promise.all([
    prisma.notification.findMany({
      where: {
        recipientId: auth.user.id,
        trashedAt: view === 'trash' ? { not: null } : null,
        ...(view !== 'trash' && { archivedAt: view === 'archive' ? { not: null } : null }),
      },
      orderBy: { createdAt: 'desc' },
      take: validation.data.limit,
      select: { id: true, prId: true, sourceAuditLogId: true, title: true, message: true, actionPath: true, readAt: true, archivedAt: true, trashedAt: true, purgeAfter: true, createdAt: true },
    }),
    prisma.notification.count({ where: { recipientId: auth.user.id, readAt: null, archivedAt: null, trashedAt: null } }),
    prisma.notification.count({ where: { recipientId: auth.user.id, trashedAt: { not: null } } }),
    prisma.notification.count({ where: { recipientId: auth.user.id, archivedAt: { not: null }, trashedAt: null } }),
  ]);

  return NextResponse.json({ success: true, data: { notifications, unreadCount, trashCount, archiveCount } });
}
