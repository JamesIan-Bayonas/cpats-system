import { NextRequest, NextResponse } from 'next/server';
import { PRStatus, Role } from '@prisma/client';
import { prisma } from '@/shared/prisma';
import { ReleaseCheckSchema } from '@/validation/check.schema';
import { authorizeRequest } from '@/shared/rbac';

export async function POST(request: NextRequest) {
  try {
    const auth = await authorizeRequest(request, Role.Business_Office);
    if (!auth.success) return auth.response;
    const activeUser = auth.user;

    const rawBody = await request.json();
    const validation = ReleaseCheckSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, errors: validation.error.format() },
        { status: 422 }
      );
    }

    const { poId, checkNumber } = validation.data;

    const transactionResult = await prisma.$transaction(async (tx) => {
      const targetPO = await tx.purchaseOrder.findUnique({
        where: { id: poId }
      });

      if (!targetPO) {
        throw new Error("PURCHASE_ORDER_NOT_FOUND");
      }

      if (targetPO.isCheckIssued) {
        throw new Error("CHECK_ALREADY_RELEASED");
      }

      const parentPR = await tx.purchaseRequest.findUnique({
        where: { id: targetPO.purchaseRequestId }
      });

      if (!parentPR) {
        throw new Error("PARENT_REQUISITION_NOT_FOUND");
      }

      if (parentPR.status !== PRStatus.Awaiting_Check_Issuance) {
        throw new Error("INVALID_LIFECYCLE_STAGE");
      }

      const updatedPO = await tx.purchaseOrder.update({
        where: { id: poId },
        data: { isCheckIssued: true }
      });

      await tx.purchaseRequest.update({
        where: { id: targetPO.purchaseRequestId },
        data: { status: PRStatus.Ready_for_Purchase }
      });

      await tx.auditLog.create({
        data: {
          prId: targetPO.purchaseRequestId,
          actorId: activeUser.id,
          previousState: PRStatus.Awaiting_Check_Issuance,
          newState: PRStatus.Ready_for_Purchase,
          remarks: `Financial Check Released. Check Number Reference: [${checkNumber}].`
        }
      });

      return updatedPO;
    });

    return NextResponse.json({ success: true, data: transactionResult }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof Error) {
      switch (error.message) {
        case "PURCHASE_ORDER_NOT_FOUND":
          return NextResponse.json({ success: false, error: "The targeted Purchase Order entity does not exist." }, { status: 404 });
        case "CHECK_ALREADY_RELEASED":
          return NextResponse.json({ success: false, error: "Data Collision: Check has already been issued." }, { status: 400 });
        case "INVALID_LIFECYCLE_STAGE":
          return NextResponse.json({ success: false, error: "State Transition Violation: Target is not in Awaiting_Check_Issuance status." }, { status: 409 });
        default:
          return NextResponse.json({ success: false, error: "Database Execution Fault." }, { status: 500 });
      }
    }
    return NextResponse.json({ success: false, error: "An unclassified system exception occurred." }, { status: 500 });
  }
}