import { NextRequest, NextResponse } from 'next/server';
import { Role } from '@prisma/client';
import { prisma } from '@/shared/prisma';
import { authorizeRequest } from '@/shared/rbac';
import { createVerificationCode, exposeDevelopmentVerificationCode, sendVerificationEmail } from '@/shared/notifications';
import { RequestEmailVerificationSchema } from '@/validation/notification.schema';

const NOTIFIED_ROLES = [Role.Business_Office, Role.Admin_Office, Role.Purchasing_Office, Role.Receiving_Custodian, Role.Global_Auditor];

export async function POST(request: NextRequest) {
  const auth = await authorizeRequest(request, NOTIFIED_ROLES);
  if (!auth.success) return auth.response;
  const validation = RequestEmailVerificationSchema.safeParse(await request.json());
  if (!validation.success) return NextResponse.json({ success: false, errors: validation.error.format() }, { status: 422 });

  const existing = await prisma.notificationPreference.findUnique({ where: { userId: auth.user.id } });
  if (existing?.verificationSentAt && Date.now() - existing.verificationSentAt.getTime() < 60_000) {
    return NextResponse.json({ success: false, error: 'Please wait one minute before requesting another code.' }, { status: 429 });
  }

  const { code, hash } = createVerificationCode();
  try {
    await sendVerificationEmail(validation.data.email, code);
  } catch (error) {
    console.error('Verification email delivery failed:', error);
    return NextResponse.json({ success: false, error: 'The verification email could not be delivered. Check the mail configuration and try again.' }, { status: 503 });
  }

  await prisma.notificationPreference.upsert({
    where: { userId: auth.user.id },
    create: { userId: auth.user.id, pendingEmail: validation.data.email, verificationTokenHash: hash, verificationExpiresAt: new Date(Date.now() + 15 * 60_000), verificationSentAt: new Date() },
    update: { pendingEmail: validation.data.email, verificationTokenHash: hash, verificationExpiresAt: new Date(Date.now() + 15 * 60_000), verificationAttempts: 0, verificationSentAt: new Date() },
  });

  return NextResponse.json({ success: true, data: { pendingEmail: validation.data.email, devVerificationCode: exposeDevelopmentVerificationCode(code) } });
}
