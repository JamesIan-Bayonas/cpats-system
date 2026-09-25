import { NextRequest, NextResponse } from 'next/server';
import { PRStatus, Role } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/shared/prisma';
import { authorizeRequest } from '@/shared/rbac';

export async function GET(request: NextRequest) {
  try {
    const auth = await authorizeRequest(request, Role.Requesting_Office);
    if (!auth.success) return auth.response;

    const parsedId = z.string().uuid().safeParse(request.nextUrl.searchParams.get('prId'));
    if (!parsedId.success) {
      return NextResponse.json(
        { success: false, error: 'A valid declined request reference is required.' },
        { status: 400 }
      );
    }

    const record = await prisma.purchaseRequest.findUnique({
      where: { id: parsedId.data },
      include: {
        auditLogs: {
          where: { newState: PRStatus.Declined },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            remarks: true,
            createdAt: true,
            actor: { select: { role: true } },
          },
        },
      },
    });

    if (!record || record.departmentId !== auth.user.departmentId) {
      return NextResponse.json(
        { success: false, error: 'Declined request not found for your department.' },
        { status: 404 }
      );
    }

    if (record.status !== PRStatus.Declined) {
      return NextResponse.json(
        { success: false, error: 'This request is no longer declined.' },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: record.id,
        justification: record.justification,
        itemsPayload: record.itemsPayload,
        isDirectPoBypass: record.isDirectPoBypass,
        adminProofFilePath: record.adminProofFilePath,
        feedback: record.auditLogs[0] ?? null,
      },
    });
  } catch (error: unknown) {
    console.error('DECLINED TEMPLATE LOAD FAILURE:', error);
    return NextResponse.json(
      { success: false, error: 'Unable to load the declined request.' },
      { status: 500 }
    );
  }
}
