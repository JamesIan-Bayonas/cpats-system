import { NextRequest, NextResponse } from 'next/server';
import { Role } from '@prisma/client';
import { prisma } from '@/shared/prisma';
import { authorizeRequest } from '@/shared/rbac';
import { UpdateNotificationSettingsSchema } from '@/validation/notification.schema';

const NOTIFIED_ROLES = Object.values(Role);

export async function GET(request: NextRequest) {
  const auth = await authorizeRequest(request, NOTIFIED_ROLES);
  if (!auth.success) return auth.response;
  const preference = await prisma.notificationPreference.findUnique({ where: { userId: auth.user.id } });
  return NextResponse.json({ success: true, data: {
    notificationEmail: preference?.notificationEmail ?? null,
    pendingEmail: preference?.pendingEmail ?? null,
    emailVerifiedAt: preference?.emailVerifiedAt ?? null,
    emailNotificationsEnabled: preference?.emailNotificationsEnabled ?? false,
  } });
}

export async function PATCH(request: NextRequest) {
  const auth = await authorizeRequest(request, NOTIFIED_ROLES);
  if (!auth.success) return auth.response;
  const validation = UpdateNotificationSettingsSchema.safeParse(await request.json());
  if (!validation.success) return NextResponse.json({ success: false, errors: validation.error.format() }, { status: 422 });

  const existing = await prisma.notificationPreference.findUnique({ where: { userId: auth.user.id } });
  if (validation.data.emailNotificationsEnabled === true && (!existing?.notificationEmail || !existing.emailVerifiedAt)) {
    return NextResponse.json({ success: false, error: 'Verify a notification email before enabling delivery.' }, { status: 409 });
  }

  const data = validation.data.unlink
    ? { notificationEmail: null, pendingEmail: null, emailVerifiedAt: null, emailNotificationsEnabled: false, verificationTokenHash: null, verificationExpiresAt: null, verificationAttempts: 0 }
    : { emailNotificationsEnabled: validation.data.emailNotificationsEnabled };
  const preference = await prisma.notificationPreference.upsert({
    where: { userId: auth.user.id },
    create: { userId: auth.user.id, ...data },
    update: data,
  });
  return NextResponse.json({ success: true, data: { notificationEmail: preference.notificationEmail, emailVerifiedAt: preference.emailVerifiedAt, emailNotificationsEnabled: preference.emailNotificationsEnabled } });
}
