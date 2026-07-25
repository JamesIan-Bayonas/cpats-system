import { NextRequest, NextResponse } from 'next/server';
import { PRStatus, Role, ConditionNote } from '@prisma/client';
import { prisma } from '@/shared/prisma';
import { CreateReceivingReportSchema } from '@/validation/receiving.schema';
import { authorizeRequest } from '@/shared/rbac';

export async function POST(request: NextRequest) {
  try {
    const auth = await authorizeRequest(request, Role.Receiving_Custodian);
    if (!auth.success) return auth.response;
    const activeUser = auth.user;

    const rawBody = await request.json();
    const validation = CreateReceivingReportSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, errors: validation.error.format() },
        { status: 422 }
      );
    }

    const { purchaseOrderId, condition, invoiceFilePath, asssetImageFilePath, remarks } = validation.data;

    const transactionResult = await prisma.$transaction(async (tx) => {
      const targetPO = await tx.purchaseOrder.findUnique({
        where: { id: purchaseOrderId },
        include: { purchaseRequest: true }
      });

      if (!targetPO) {
        throw new Error("PURCHASE_ORDER_NOT_FOUND");
      }

      if (targetPO.purchaseRequest.status !== PRStatus.Ready_for_Purchase) {
        throw new Error("INVALID_LIFECYCLE_STAGE");
      }

      const newReport = await tx.receivingReport.create({
        data: {
          purchaseOrderId: purchaseOrderId,
          condition: condition as ConditionNote,
          invoiceFilePath: invoiceFilePath,
          asssetImageFilePath: asssetImageFilePath,
          remarks: remarks || null
        }
      });

      await tx.purchaseRequest.update({
        where: { id: targetPO.purchaseRequestId },
        data: { status: PRStatus.Received_and_Closed }
      });

      await tx.auditLog.create({
        data: {
          prId: targetPO.purchaseRequestId,
          actorId: activeUser.id,
          previousState: PRStatus.Ready_for_Purchase,
          newState: PRStatus.Received_and_Closed,
          remarks: `Asset inspection finalized. Condition: [${condition}]. Physical photo record [${asssetImageFilePath}] bound.`
        }
      });

      return newReport;
    });

    return NextResponse.json({ success: true, data: transactionResult }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error) {
      switch (error.message) {
        case "PURCHASE_ORDER_NOT_FOUND":
          return NextResponse.json({ success: false, error: "The targeted Purchase Order reference does not exist." }, { status: 404 });
        case "INVALID_LIFECYCLE_STAGE":
          return NextResponse.json({ success: false, error: "State Transition Violation: Target must have 'Ready_for_Purchase' status." }, { status: 409 });
        default:
          return NextResponse.json({ success: false, error: "Database Execution Fault." }, { status: 500 });
      }
    }
    return NextResponse.json({ success: false, error: "An unclassified system exception occurred." }, { status: 500 });
  }
}