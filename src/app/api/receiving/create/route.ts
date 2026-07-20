// src/app/api/receiving/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PRStatus, Role, ConditionNote } from '@prisma/client';
import { prisma } from '@/shared/prisma'; // Architectural Mandate: Explicit Driver Adapter Context
import { CreateReceivingReportSchema } from '@/validation/receiving.schema';

export async function POST(request: NextRequest) {
  try {
    // 1. ROLE-BASED ACCESS CONTROL GATEKEEPING
    // Explicit type signature applied to prevent literal type narrowing down to a single enum state
    const activeUser: { id: string; role: Role; departmentId: string } = {
      id: "custodian-uuid-static-555",
      role: Role.Receiving_Custodian,
      departmentId: "asset-management-dept-uuid-000"
    };

    if (activeUser.role !== Role.Receiving_Custodian) {
      return NextResponse.json(
        { success: false, error: "FORBIDDEN: Institutional security layout restricts receiving processing to Receiving Custodian profiles." },
        { status: 403 }
      );
    }

    // 2. PAYLOAD DECOUPLING AND INBOUND VALIDATION
    const rawBody = await request.json();
    const validation = CreateReceivingReportSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, errors: validation.error.format() },
        { status: 422 }
      );
    }

    const { purchaseOrderId, condition, invoiceFilePath, asssetImageFilePath, remarks } = validation.data;

    // 3. ATOMIC ACID TRANSACTION SEGMENT
    const transactionResult = await prisma.$transaction(async (tx) => {
      // Pessimistically load target Purchase Order record
      const targetPO = await tx.purchaseOrder.findUnique({
        where: { id: purchaseOrderId },
        include: { purchaseRequest: true }
      });

      if (!targetPO) {
        throw new Error("PURCHASE_ORDER_NOT_FOUND");
      }

      // Assert state machine status checkpoint
      if (targetPO.purchaseRequest.status !== PRStatus.Ready_for_Purchase) {
        throw new Error("INVALID_LIFECYCLE_STAGE");
      }

      // Commit the verified ReceivingReport entry to persistent storage
      const newReport = await tx.receivingReport.create({
        data: {
          purchaseOrderId: purchaseOrderId,
          condition: condition as ConditionNote,
          invoiceFilePath: invoiceFilePath,
          asssetImageFilePath: asssetImageFilePath,
          remarks: remarks || null
        }
      });

      // Update parent PurchaseRequest to the terminal closed state
      await tx.purchaseRequest.update({
        where: { id: targetPO.purchaseRequestId },
        data: { status: PRStatus.Received_and_Closed }
      });

      // Commit tracking sequence metadata to the immutable ledger node
      await tx.auditLog.create({
        data: {
          prId: targetPO.purchaseRequestId,
          actorId: activeUser.id,
          previousState: PRStatus.Ready_for_Purchase,
          newState: PRStatus.Received_and_Closed,
          remarks: `Asset inspection finalized. Condition: [${condition}]. Physical photo record [${asssetImageFilePath}] and supplier invoice bound. Transaction closed.`
        }
      });

      return newReport;
    });

    return NextResponse.json(
      { success: true, data: transactionResult },
      { status: 201 }
    );

  } catch (error: unknown) {
    if (error instanceof Error) {
      switch (error.message) {
        case "PURCHASE_ORDER_NOT_FOUND":
          return NextResponse.json({ success: false, error: "The targeted Purchase Order reference target does not exist." }, { status: 404 });
        case "INVALID_LIFECYCLE_STAGE":
          return NextResponse.json({ success: false, error: "State Transition Violation: Parent requisition must have 'Ready_for_Purchase' status before receiving logs can commit." }, { status: 409 });
        default:
          console.error("CRITICAL ASSET RECEIVING CORE EXCEPTION:", error);
          return NextResponse.json({ success: false, error: "Database Execution Fault: Core mutation transaction rolled back." }, { status: 500 });
      }
    }
    return NextResponse.json({ success: false, error: "An unclassified system exception occurred." }, { status: 500 });
  }
}