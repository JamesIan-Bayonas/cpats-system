// src/app/api/pr/queue/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Role, PRStatus } from '@prisma/client';
import { prisma } from '@/shared/prisma';
import { QueueFetchSchema } from '@/validation/queue.schema';
import { authorizeRequest } from '@/shared/rbac';

export async function POST(request: NextRequest) {
  try {
    const auth = await authorizeRequest(request, Object.values(Role));
    if (!auth.success) return auth.response;
    const activeUser = auth.user;

    const rawBody = await request.json();
    const validation = QueueFetchSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, errors: validation.error.format() },
        { status: 422 }
      );
    }

    const { role, departmentId } = validation.data;

    if (activeUser.role !== Role.Global_Auditor && activeUser.role !== role) {
      return NextResponse.json(
        { success: false, error: `FORBIDDEN: User role '${activeUser.role}' cannot access queue for '${role}'.` },
        { status: 403 }
      );
    }

    const targetedDepartmentId = departmentId || activeUser.departmentId;

    switch (role) {
      case Role.Requesting_Office:
        const regionalRequests = await prisma.purchaseRequest.findMany({
          where: { departmentId: targetedDepartmentId },
          orderBy: { updatedAt: 'desc' },
          include: {
            department: { select: { code: true, name: true } },
            auditLogs: {
              orderBy: { createdAt: 'desc' },
              include: {
                actor: { select: { email: true, role: true } }
              }
            }
          }
        });
        return NextResponse.json({ success: true, data: regionalRequests }, { status: 200 });

      case Role.Business_Office:
        const businessQueue = await prisma.purchaseRequest.findMany({
          where: {
            status: {
              in: [
                PRStatus.Pending_Business_Approval,
                PRStatus.Awaiting_Check_Issuance,
                PRStatus.Returned_for_Correction
              ]
            }
          },
          orderBy: { createdAt: 'asc' },
          include: {
            department: { select: { code: true, name: true } },
            purchaseOrders: { select: { id: true, poNumber: true, isCheckIssued: true } },
            auditLogs: {
              orderBy: { createdAt: 'desc' },
              include: {
                actor: { select: { email: true, role: true } }
              }
            }
          }
        });
        return NextResponse.json({ success: true, data: businessQueue }, { status: 200 });

      case Role.Admin_Office:
        const adminQueue = await prisma.purchaseRequest.findMany({
          where: { status: PRStatus.Pending_Admin_Approval },
          orderBy: { createdAt: 'asc' },
          include: {
            department: { select: { code: true, name: true } },
            auditLogs: {
              orderBy: { createdAt: 'desc' },
              include: {
                actor: { select: { email: true, role: true } }
              }
            }
          }
        });
        return NextResponse.json({ success: true, data: adminQueue }, { status: 200 });

      case Role.Purchasing_Office:
        const purchasingQueue = await prisma.purchaseRequest.findMany({
          where: { status: PRStatus.Approved_Awaiting_PO },
          orderBy: { createdAt: 'asc' },
          include: { department: { select: { code: true, name: true } } }
        });
        return NextResponse.json({ success: true, data: purchasingQueue }, { status: 200 });

      case Role.Receiving_Custodian:
        const receivingQueue = await prisma.purchaseOrder.findMany({
          where: {
            purchaseRequest: { status: PRStatus.Ready_for_Purchase },
            receivingReports: { none: {} }
          },
          orderBy: { createdAt: 'asc' },
          include: {
            purchaseRequest: {
              include: { department: { select: { code: true, name: true } } }
            }
          }
        });
        return NextResponse.json({ success: true, data: receivingQueue }, { status: 200 });

      default:
        return NextResponse.json(
          { success: false, error: "CRITICAL COMPLIANCE ERROR: Role parameters match outside functional data queues." },
          { status: 400 }
        );
    }
  } catch (error: unknown) {
    console.error("QUEUE ACQUISITION ENGINE CRASH:", error);
    return NextResponse.json(
      { success: false, error: "Relational data tracking node failed to resolve matching line entities." },
      { status: 500 }
    );
  }
}