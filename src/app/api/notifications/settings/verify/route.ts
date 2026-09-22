import { NextRequest, NextResponse } from 'next/server';
import { Role } from '@prisma/client';
import { prisma } from '@/shared/prisma';
import { authorizeRequest } from '@/shared/rbac';
import { isVerificationCodeValid } from '@/shared/notifications';
import { VerifyEmailSchema } from '@/validation/notification.schema';

const NOTIFIED_ROLES = [Role.Business_Office, Role.Admin_Office, Role.Purchasing_Office, Role.Receiving_Custodian, Role.Global_Auditor];

export async function POST(request: NextRequest) {
  const auth = await authorizeRequest(request, NOTIFIED_ROLES);
  if (!auth.success) return auth.response;
  const validation = VerifyEmailSchema.safeParse(await request.json());
  if (!validation.success) return NextResponse.json({ success: false, errors: validation.error.format() }, { status: 422 });

  const preference = await prisma.notificationPreference.findUnique({ where: { userId: auth.user.id } });
  if (!preference?.pendingEmail || !preference.verificationTokenHash || !preference.verificationExpiresAt) {
    return NextResponse.json({ success: false, error: 'Request a new verification code first.' }, { status: 409 });
  }
  if (preference.verificationAttempts >= 5) return NextResponse.json({ success: false, error: 'Too many attempts. Request a new code.' }, { status: 429 });
  if (preference.verificationExpiresAt < new Date()) return NextResponse.json({ success: false, error: 'This code has expired. Request a new one.' }, { status: 410 });

  if (!isVerificationCodeValid(validation.data.code, preference.verificationTokenHash)) {
    await prisma.notificationPreference.update({ where: { userId: auth.user.id }, data: { verificationAttempts: { increment: 1 } } });
    return NextResponse.json({ success: false, error: 'The verification code is incorrect.' }, { status: 422 });
  }

  const verifiedAt = new Date();
  const updated = await prisma.notificationPreference.update({
    where: { userId: auth.user.id },
    data: { notificationEmail: preference.pendingEmail, pendingEmail: null, emailVerifiedAt: verifiedAt, emailNotificationsEnabled: true, verificationTokenHash: null, verificationExpiresAt: null, verificationAttempts: 0 },
  });
  return NextResponse.json({ success: true, data: { notificationEmail: updated.notificationEmail, emailVerifiedAt: updated.emailVerifiedAt, emailNotificationsEnabled: updated.emailNotificationsEnabled } });
}
