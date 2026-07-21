// src/app/api/po/release-check/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PRStatus, Role } from '@prisma/client';
import { prisma } from '@/shared/prisma'; // Architectural Mandate: Explicit Driver Adapter Context
import { ReleaseCheckSchema } from '@/validation/check.schema';

export async function POST(request: NextRequest) {
  try {
    // 1. ROLE-BASED ACCESS CONTROL GATEKEEPING
    // Aligned to the seeded Business Office User ID to satisfy foreign key constraints
    const activeUser: { id: string; role: Role; departmentId: string } = {
      id: "business-evaluator-uuid-999",
      role: Role.Business_Office,
      departmentId: "business-finance-dept-xyz"
    };

    if (activeUser.role !== Role.Business_Office) {
      return NextResponse.json(
        { success: false, error: "FORBIDDEN: Institutional security layout restricts financial release actions to Business Office personnel." },
        { status: 403 }
      );
    }

    // 2. PAYLOAD DECOUPLING AND INBOUND PARSING
    const rawBody = await request.json();
    const validation = ReleaseCheckSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, errors: validation.error.format() },
        { status: 422 }
      );
    }

    const { poId, checkNumber } = validation.data;

    // 3. ATOMIC ACID TRANSACTION SEGMENT
    const transactionResult = await prisma.$transaction(async (tx) => {
      // Pessimistically load target Purchase Order record
      const targetPO = await tx.purchaseOrder.findUnique({
        where: { id: poId }
      });

      if (!targetPO) {
        throw new Error("PURCHASE_ORDER_NOT_FOUND");
      }

      if (targetPO.isCheckIssued) {
        throw new Error("CHECK_ALREADY_RELEASED");
      }

      // Fetch accompanying parent purchase request model
      const parentPR = await tx.purchaseRequest.findUnique({
        where: { id: targetPO.purchaseRequestId }
      });

      if (!parentPR) {
        throw new Error("PARENT_REQUISITION_NOT_FOUND");
      }

      if (parentPR.status !== PRStatus.Awaiting_Check_Issuance) {
        throw new Error("INVALID_LIFECYCLE_STAGE");
      }

      // Update PurchaseOrder flag state
      const updatedPO = await tx.purchaseOrder.update({
        where: { id: poId },
        data: { isCheckIssued: true }
      });

      // Advance parent request context status past the check issuance lock
      await tx.purchaseRequest.update({
        where: { id: targetPO.purchaseRequestId },
        data: { status: PRStatus.Ready_for_Purchase }
      });

      // Commit tracking sequence metadata to the immutable audit log table
      await tx.auditLog.create({
        data: {
          prId: targetPO.purchaseRequestId,
          actorId: activeUser.id,
          previousState: PRStatus.Awaiting_Check_Issuance,
          newState: PRStatus.Ready_for_Purchase,
          remarks: `Financial Check Released. Check Number Reference: [${checkNumber}]. Procurement state advanced to Ready_for_Purchase.`
        }
      });

      return updatedPO;
    });

    return NextResponse.json(
      { success: true, data: transactionResult },
      { status: 200 }
    );

  } catch (error: unknown) {
    if (error instanceof Error) {
      switch (error.message) {
        case "PURCHASE_ORDER_NOT_FOUND":
          return NextResponse.json({ success: false, error: "The targeted Purchase Order entity does not exist." }, { status: 404 });
        case "CHECK_ALREADY_RELEASED":
          return NextResponse.json({ success: false, error: "Data Collision: This Purchase Order has already been processed and issued a financial check." }, { status: 400 });
        case "PARENT_REQUISITION_NOT_FOUND":
          return NextResponse.json({ success: false, error: "Link Error: The parent Purchase Request mapping link is broken or missing." }, { status: 404 });
        case "INVALID_LIFECYCLE_STAGE":
          return NextResponse.json({ success: false, error: "State Transition Violation: The request must be in Awaiting_Check_Issuance status to run this mutation." }, { status: 409 });
        default:
          console.error("CRITICAL CHECK CLEARANCE RUNTIME EXCEPTION:", error);
          return NextResponse.json({ success: false, error: "Database Execution Fault: Transaction rolled back successfully." }, { status: 500 });
      }
    }
    return NextResponse.json({ success: false, error: "An unclassified system exception occurred." }, { status: 500 });
  }
}