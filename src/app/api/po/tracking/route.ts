import { NextRequest, NextResponse } from 'next/server';
import { PRStatus, Role } from '@prisma/client';
import { prisma } from '@/shared/prisma';
import { authorizeRequest } from '@/shared/rbac';

const PURCHASING_TRACKING_STATUSES = [
  PRStatus.Approved_Awaiting_PO,
  PRStatus.Awaiting_Check_Issuance,
  PRStatus.Ready_for_Purchase,
  PRStatus.Received_and_Closed,
];

export async function GET(request: NextRequest) {
  try {
    const auth = await authorizeRequest(request, Role.Purchasing_Office);
    if (!auth.success) return auth.response;

    const requests = await prisma.purchaseRequest.findMany({
      where: { status: { in: PURCHASING_TRACKING_STATUSES } },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        justification: true,
        itemsPayload: true,
        status: true,
        isDirectPoBypass: true,
        createdAt: true,
        updatedAt: true,
        department: { select: { code: true, name: true } },
        purchaseOrders: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            poNumber: true,
            paymentType: true,
            isCheckIssued: true,
            createdAt: true,
            receivingReports: {
              orderBy: { createdAt: 'desc' },
              select: { condition: true, remarks: true, createdAt: true },
            },
          },
        },
        auditLogs: {
          where: { newState: { in: PURCHASING_TRACKING_STATUSES } },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            previousState: true,
            newState: true,
            remarks: true,
            createdAt: true,
            actor: { select: { email: true, role: true } },
          },
        },
      },
    });

    return NextResponse.json(
      { success: true, count: requests.length, data: requests },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error: unknown) {
    console.error('PURCHASING TRACKING FAILURE:', error);
    return NextResponse.json(
      { success: false, error: 'The Purchasing Office tracking register could not be loaded.' },
      { status: 500 },
    );
  }
}
