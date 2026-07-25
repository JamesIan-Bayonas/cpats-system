import { NextRequest, NextResponse } from 'next/server';
import { PRStatus, Role } from '@prisma/client';
import { prisma } from '@/shared/prisma';
import { BusinessEvaluationSchema } from '@/validation/business.schema';
import { authorizeRequest } from '@/shared/rbac';

export async function POST(request: NextRequest) {
  try {
    const auth = await authorizeRequest(request, Role.Business_Office);
    if (!auth.success) return auth.response;
    const activeUser = auth.user;

    const rawBody = await request.json();
    const validation = BusinessEvaluationSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, errors: validation.error.format() },
        { status: 422 }
      );
    }

    const { prId, action, remarks } = validation.data;

    const currentPR = await prisma.purchaseRequest.findUnique({
      where: { id: prId },
      select: { id: true, status: true }
    });

    if (!currentPR) {
      return NextResponse.json(
        { success: false, error: "NOT FOUND: Target purchase request could not be located." },
        { status: 404 }
      );
    }

    if (currentPR.status !== PRStatus.Pending_Business_Approval) {
      return NextResponse.json(
        { success: false, error: `INVALID OPERATION STATE: Target request is currently in '${currentPR.status}' status.` },
        { status: 400 }
      );
    }

    let nextState: PRStatus;
    if (action === 'APPROVE') {
      nextState = PRStatus.Pending_Admin_Approval;
    } else if (action === 'DECLINE') {
      nextState = PRStatus.Declined;
    } else {
      nextState = PRStatus.Returned_for_Correction;
    }

    const transactionResult = await prisma.$transaction(async (tx) => {
      const updatedRequest = await tx.purchaseRequest.update({
        where: { id: prId },
        data: { status: nextState }
      });

      await tx.auditLog.create({
        data: {
          prId: prId,
          actorId: activeUser.id,
          previousState: currentPR.status,
          newState: nextState,
          remarks: remarks
        }
      });

      return updatedRequest;
    });

    return NextResponse.json({ success: true, data: transactionResult }, { status: 200 });
  } catch (error: unknown) {
    console.error("CRITICAL REQUISITION EVALUATION FAILURE:", error);
    return NextResponse.json({ success: false, error: "Critical Execution Fault during state mutation." }, { status: 500 });
  }
}