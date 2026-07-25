import { NextRequest, NextResponse } from 'next/server';
import { Role, Prisma } from '@prisma/client';
import { prisma } from '@/shared/prisma';
import { AuditFilterSchema } from '@/validation/audit.schema';
import { authorizeRequest } from '@/shared/rbac';

export async function POST(request: NextRequest) {
  try {
    const auth = await authorizeRequest(request, Role.Global_Auditor);
    if (!auth.success) return auth.response;

    const rawBody = await request.json();
    const validation = AuditFilterSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, errors: validation.error.format() },
        { status: 422 }
      );
    }

    const { departmentId, status, dateFrom, dateTo, sortField, sortOrder } = validation.data;

    const queryConditions: Prisma.PurchaseRequestWhereInput = {};

    if (departmentId) {
      queryConditions.departmentId = departmentId;
    }

    if (status) {
      queryConditions.status = status;
    }

    if (dateFrom || dateTo) {
      queryConditions.createdAt = {
        ...(dateFrom && { gte: new Date(dateFrom) }),
        ...(dateTo && { lte: new Date(dateTo) }),
      };
    }

    const reports = await prisma.purchaseRequest.findMany({
      where: queryConditions,
      orderBy: {
        [sortField]: sortOrder,
      },
      include: {
        department: {
          select: { name: true, code: true }
        },
        purchaseOrders: {
          select: { poNumber: true, isCheckIssued: true }
        },
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          select: {
            createdAt: true,
            previousState: true,
            newState: true,
            remarks: true,
            actor: {
              select: { email: true, role: true }
            }
          }
        }
      }
    });

    return NextResponse.json({ success: true, count: reports.length, data: reports }, { status: 200 });
  } catch (error: unknown) {
    console.error("CRITICAL AUDITING EXTRACTION FAILURE:", error);
    return NextResponse.json({ success: false, error: "Internal Server Analytics Fault." }, { status: 500 });
  }
}