import { NextRequest, NextResponse } from 'next/server';
import { PRStatus, Role } from '@prisma/client';
import { prisma } from '@/shared/prisma';
import { authorizeRequest } from '@/shared/rbac';

const ADMIN_DECISIONS = [
  PRStatus.Approved_Awaiting_PO,
  PRStatus.Returned_for_Correction,
  PRStatus.Declined,
];

export async function GET(request: NextRequest) {
  const auth = await authorizeRequest(request, Role.Admin_Office);
  if (!auth.success) return auth.response;

  try {
    const records = await prisma.purchaseRequest.findMany({
      where: {
        auditLogs: {
          some: {
            actor: { role: Role.Admin_Office },
            previousState: PRStatus.Pending_Admin_Approval,
            newState: { in: ADMIN_DECISIONS },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        justification: true,
        status: true,
        isDirectPoBypass: true,
        adminProofFilePath: true,
        createdAt: true,
        itemsPayload: true,
        department: { select: { code: true, name: true } },
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            createdAt: true,
            previousState: true,
            newState: true,
            remarks: true,
            actor: { select: { email: true, role: true } },
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: records });
  } catch (error) {
    console.error('ADMIN DECISION HISTORY LOAD FAILURE:', error);
    return NextResponse.json({ success: false, error: 'Unable to load Admin decision history.' }, { status: 500 });
  }
}
