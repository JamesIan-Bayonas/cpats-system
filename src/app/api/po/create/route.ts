import { NextRequest, NextResponse } from 'next/server';
import { PRStatus, Role, PaymentType } from '@prisma/client';
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

    const { purchaseRequestId, poNumber, paymentType } = validation.data;

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

      // Branch workflow state based on purchase payment modality
      const targetPRStatus = paymentType === 'CREDIT_TERMS' 
        ? PRStatus.Ready_for_Purchase 
        : PRStatus.Awaiting_Check_Issuance;

      const newPO = await tx.purchaseOrder.create({
        data: {
          poNumber: poNumber,
          purchaseRequestId: purchaseRequestId,
          qrCodeToken: generatedQrToken,
          paymentType: paymentType as PaymentType,
          isCheckIssued: paymentType === 'CREDIT_TERMS' ? true : false
        }
      });

      await tx.purchaseRequest.update({
        where: { id: purchaseRequestId },
        data: { status: targetPRStatus }
      });

      await tx.auditLog.create({
        data: {
          prId: purchaseRequestId,
          actorId: activeUser.id,
          previousState: PRStatus.Approved_Awaiting_PO,
          newState: targetPRStatus,
          remarks: paymentType === 'CREDIT_TERMS'
            ? `Authoritative PO bound under CREDIT / CHARGE TERMS: ${poNumber}. Direct transmission to supplier on 30-day terms; bypassed pre-purchase check release.`
            : `Authoritative PO bound under CASH / CHECK MODALITY: ${poNumber}. Unique Cryptographic Tag Generated.`
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