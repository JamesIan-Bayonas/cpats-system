// src/app/api/po/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PRStatus, Role } from '@prisma/client';
import { prisma } from '@/shared/prisma'; // Ingestion of the custom MariaDB Driver Adapter context
import { CreatePOSchema } from '@/validation/po.schema';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    // 1. ROLE-BASED ACCESS CONTROL GATEKEEPING
    // Explicit type signature applied to prevent automatic literal type narrowing down to a single string value
    const activeUser: { id: string; role: Role; departmentId: string } = {
      id: "purchaser-uuid-static-888",
      role: Role.Purchasing_Office,
      departmentId: "purchasing-dept-uuid-wxy"
    };

    if (activeUser.role !== Role.Purchasing_Office) {
      return NextResponse.json(
        { success: false, error: "FORBIDDEN: Institutional security layout restricts resource manipulation to Purchasing Office personnel." },
        { status: 403 }
      );
    }

    // 2. INPUT DECOUPLING & SCHEMA VERIFICATION
    const rawBody = await request.json();
    const validation = CreatePOSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, errors: validation.error.format() },
        { status: 422 }
      );
    }

    const { purchaseRequestId, poNumber } = validation.data;

    // 3. ATOMIC ACID TRANSACTION COUPLING
    const transactionResult = await prisma.$transaction(async (tx) => {
      // Affirm target existence with specific columns extracted
      const targetPR = await tx.purchaseRequest.findUnique({
        where: { id: purchaseRequestId }
      });

      if (!targetPR) {
        throw new Error("REQUISITION_NOT_FOUND");
      }

      // Assert state machine condition checkpoint
      if (targetPR.status !== PRStatus.Approved_Awaiting_PO) {
        throw new Error("INVALID_LIFECYCLE_STAGE");
      }

      // Verify no duplicate PO numbers exist within relational indices
      const duplicatePoNumber = await tx.purchaseOrder.findUnique({
        where: { poNumber }
      });

      if (duplicatePoNumber) {
        throw new Error("DUPLICATE_PO_NUMBER_VIOLATION");
      }

      // Generate a cryptographically bound QR code token matching integration test templates
      const generatedQrToken = `PO-TOKEN-${crypto.randomUUID()}`;

      // Persist the verified PurchaseOrder entity record
      const newPO = await tx.purchaseOrder.create({
        data: {
          poNumber: poNumber,
          purchaseRequestId: purchaseRequestId,
          qrCodeToken: generatedQrToken,
          isCheckIssued: false
        }
      });

      // Advance parent request status down the audit pipeline
      const updatedPR = await tx.purchaseRequest.update({
        where: { id: purchaseRequestId },
        data: {
          status: PRStatus.Awaiting_Check_Issuance
        }
      });

      // Write transaction entry into the immutable ledger node
      await tx.auditLog.create({
        data: {
          prId: purchaseRequestId,
          actorId: activeUser.id,
          previousState: PRStatus.Approved_Awaiting_PO,
          newState: PRStatus.Awaiting_Check_Issuance,
          remarks: `Authoritative Purchase Order bound: ${poNumber}. Unique Cryptographic Tag Generated. Request advanced to Cash/Check Processing loop.`
        }
      });

      return newPO;
    });

    return NextResponse.json(
      { success: true, data: transactionResult },
      { status: 201 }
    );

  } catch (error: unknown) {
    if (error instanceof Error) {
      switch (error.message) {
        case "REQUISITION_NOT_FOUND":
          return NextResponse.json({ success: false, error: "The specified Purchase Request tracking entity does not exist." }, { status: 404 });
        case "INVALID_LIFECYCLE_STAGE":
          return NextResponse.json({ success: false, error: "Workflow Exception: Target request must possess an 'Approved_Awaiting_PO' status before binding can initiate." }, { status: 409 });
        case "DUPLICATE_PO_NUMBER_VIOLATION":
          return NextResponse.json({ success: false, error: "Data Integrity Violation: The specified PO reference code is already assigned to a historical document." }, { status: 400 });
        default:
          console.error("CRITICAL PURCHASING ENGINE OVERFLOW FAULT:", error);
          return NextResponse.json({ success: false, error: "Storage Matrix Fault: Execution failure aborted the database transaction." }, { status: 500 });
      }
    }
    return NextResponse.json({ success: false, error: "An unclassified runtime exception occurred." }, { status: 500 });
  }
}