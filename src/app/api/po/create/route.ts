import { NextRequest, NextResponse } from 'next/server';
import { PRStatus, Role } from '@prisma/client';
import { prisma } from '@/shared/prisma';
import { CreatePOSchema } from '@/validation/po.schema';
import { authorizeRequest } from '@/shared/rbac';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const auth = await authorizeRequest(request, Role.Purchasing_Office);
    if (!auth.success) return auth.response;
    const activeUser = auth.user;

    const rawBody = await request.json();
    const validation = CreatePOSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, errors: validation.error.format() },
        { status: 422 }
      );
    }

    const { purchaseRequestId, poNumber } = validation.data;

    const transactionResult = await prisma.$transaction(async (tx) => {
      const targetPR = await tx.purchaseRequest.findUnique({
        where: { id: purchaseRequestId }
      });

      if (!targetPR) {
        throw new Error("REQUISITION_NOT_FOUND");
      }

      if (targetPR.status !== PRStatus.Approved_Awaiting_PO) {
        throw new Error("INVALID_LIFECYCLE_STAGE");
      }

      const duplicatePoNumber = await tx.purchaseOrder.findUnique({
        where: { poNumber }
      });

      if (duplicatePoNumber) {
        throw new Error("DUPLICATE_PO_NUMBER_VIOLATION");
      }

      const generatedQrToken = `PO-TOKEN-${crypto.randomUUID()}`;

      const newPO = await tx.purchaseOrder.create({
        data: {
          poNumber: poNumber,
          purchaseRequestId: purchaseRequestId,
          qrCodeToken: generatedQrToken,
          isCheckIssued: false
        }
      });

      await tx.purchaseRequest.update({
        where: { id: purchaseRequestId },
        data: { status: PRStatus.Awaiting_Check_Issuance }
      });

      await tx.auditLog.create({
        data: {
          prId: purchaseRequestId,
          actorId: activeUser.id,
          previousState: PRStatus.Approved_Awaiting_PO,
          newState: PRStatus.Awaiting_Check_Issuance,
          remarks: `Authoritative Purchase Order bound: ${poNumber}. Unique Cryptographic Tag Generated.`
        }
      });

      return newPO;
    });

    return NextResponse.json({ success: true, data: transactionResult }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error) {
      switch (error.message) {
        case "REQUISITION_NOT_FOUND":
          return NextResponse.json({ success: false, error: "The specified Purchase Request tracking entity does not exist." }, { status: 404 });
        case "INVALID_LIFECYCLE_STAGE":
          return NextResponse.json({ success: false, error: "Workflow Exception: Target request must possess an 'Approved_Awaiting_PO' status." }, { status: 409 });
        case "DUPLICATE_PO_NUMBER_VIOLATION":
          return NextResponse.json({ success: false, error: "Data Integrity Violation: The specified PO reference code is already assigned." }, { status: 400 });
        default:
          return NextResponse.json({ success: false, error: "Storage Matrix Fault: Execution failure aborted transaction." }, { status: 500 });
      }
    }
    return NextResponse.json({ success: false, error: "An unclassified runtime exception occurred." }, { status: 500 });
  }
}