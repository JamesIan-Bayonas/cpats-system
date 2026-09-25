import { NextRequest, NextResponse } from 'next/server';
import { PRStatus, Role } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/shared/prisma';
import { authorizeRequest } from '@/shared/rbac';
import { dispatchNotificationForAuditLog } from '@/shared/notifications';
import { CreatePRSchema } from '@/validation/pr.schema';

const RequestIdSchema = z.string().uuid();

class StaleReturnedRequestError extends Error {}

export async function GET(request: NextRequest) {
  try {
    const auth = await authorizeRequest(request, Role.Requesting_Office);
    if (!auth.success) return auth.response;

    const requestId = request.nextUrl.searchParams.get('prId');
    const parsedId = RequestIdSchema.safeParse(requestId);
    if (!parsedId.success) {
      return NextResponse.json(
        { success: false, error: 'A valid returned request reference is required.' },
        { status: 400 }
      );
    }

    const record = await prisma.purchaseRequest.findUnique({
      where: { id: parsedId.data },
      include: {
        auditLogs: {
          where: { newState: PRStatus.Returned_for_Correction },
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
        { success: false, error: 'Returned request not found for your department.' },
        { status: 404 }
      );
    }

    if (record.status !== PRStatus.Returned_for_Correction) {
      return NextResponse.json(
        { success: false, error: 'This request is no longer available for correction.' },
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
        returnFeedback: record.auditLogs[0] ?? null,
      },
    });
  } catch (error: unknown) {
    console.error('RETURNED REQUEST LOAD FAILURE:', error);
    return NextResponse.json(
      { success: false, error: 'Unable to load this returned request.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await authorizeRequest(request, Role.Requesting_Office);
    if (!auth.success) return auth.response;

    const rawBody = await request.json();
    const parsedId = RequestIdSchema.safeParse(rawBody?.prId);
    const validation = CreatePRSchema.safeParse(rawBody);

    if (!parsedId.success) {
      return NextResponse.json(
        { success: false, error: 'A valid returned request reference is required.' },
        { status: 400 }
      );
    }

    if (!validation.success) {
      return NextResponse.json(
        { success: false, errors: validation.error.format() },
        { status: 422 }
      );
    }

    const currentRecord = await prisma.purchaseRequest.findUnique({
      where: { id: parsedId.data },
      select: { departmentId: true, status: true },
    });

    if (!currentRecord || currentRecord.departmentId !== auth.user.departmentId) {
      return NextResponse.json(
        { success: false, error: 'Returned request not found for your department.' },
        { status: 404 }
      );
    }

    if (currentRecord.status !== PRStatus.Returned_for_Correction) {
      return NextResponse.json(
        { success: false, error: 'This request was already processed and cannot be resubmitted again.' },
        { status: 409 }
      );
    }

    const { justification, isDirectPoBypass, adminProofFilePath, items } = validation.data;
    const executionResult = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.purchaseRequest.updateMany({
        where: {
          id: parsedId.data,
          departmentId: auth.user.departmentId,
          status: PRStatus.Returned_for_Correction,
        },
        data: {
          justification,
          itemsPayload: items,
          isDirectPoBypass,
          adminProofFilePath: isDirectPoBypass ? adminProofFilePath : null,
          status: PRStatus.Pending_Business_Approval,
        },
      });

      if (updateResult.count !== 1) throw new StaleReturnedRequestError();

      const auditLog = await tx.auditLog.create({
        data: {
          prId: parsedId.data,
          actorId: auth.user.id,
          previousState: PRStatus.Returned_for_Correction,
          newState: PRStatus.Pending_Business_Approval,
          remarks: 'Returned requisition corrected and resubmitted to the Business Office for evaluation.',
        },
      });

      const record = await tx.purchaseRequest.findUniqueOrThrow({ where: { id: parsedId.data } });
      return { record, auditLogId: auditLog.id };
    });

    await dispatchNotificationForAuditLog(executionResult.auditLogId);

    return NextResponse.json({ success: true, data: executionResult.record });
  } catch (error: unknown) {
    if (error instanceof StaleReturnedRequestError) {
      return NextResponse.json(
        { success: false, error: 'This request changed while you were editing it. Refresh the records page to see its current status.' },
        { status: 409 }
      );
    }

    console.error('RETURNED REQUEST RESUBMISSION FAILURE:', error);
    return NextResponse.json(
      { success: false, error: 'Unable to resubmit this corrected request.' },
      { status: 500 }
    );
  }
}
