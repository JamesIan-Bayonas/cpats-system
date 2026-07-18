// File Path: src/app/api/pr/evaluate-business/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, PRStatus, Role } from '@prisma/client';
import { BusinessEvaluationSchema } from '@/validation/business.schema';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    // SECURITY CONTEXT: Institutional role-based entry point validation.
    // Replace with explicit session token authentication parsing within production middleware.
    const activeUser = {
      id: "business-evaluator-uuid-999", 
      role: Role.Business_Office,
      departmentId: "business-finance-dept-xyz"
    };

    // Enforce strict Role-Based Access Control matrix bounds
    if (activeUser.role !== Role.Business_Office) {
      return NextResponse.json(
        { error: "FORBIDDEN: Insufficient clearance matrix level. Action restricted to Business Office personnel." },
        { status: 403 }
      );
    }

    // Parse payload and validate structural properties against schema definitions
    const rawBody = await request.json();
    const validation = BusinessEvaluationSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { errors: validation.error.format() },
        { status: 422 }
      );
    }

    const { prId, action, remarks } = validation.data;

    // Fetch operational status to prevent out-of-order execution states
    const currentPR = await prisma.purchaseRequest.findUnique({
      where: { id: prId },
      select: { id: true, status: true }
    });

    if (!currentPR) {
      return NextResponse.json(
        { error: "NOT FOUND: Target purchase request could not be located within persistent relational tables." },
        { status: 404 }
      );
    }

    // Prevent re-evaluation of post-initialization state modifications
    if (currentPR.status !== PRStatus.Pending_Business_Approval) {
      return NextResponse.json(
        { error: `INVALID OPERATION STATE: Target request is currently locked in '${currentPR.status}' state and cannot accept Business Office evaluation transitions.` },
        { status: 400 }
      );
    }

    // Determine target compliance state transition
    let nextState: PRStatus;
    if (action === 'APPROVE') {
      nextState = PRStatus.Pending_Admin_Approval;
    } else if (action === 'DECLINE') {
      nextState = PRStatus.Declined;
    } else {
      nextState = PRStatus.Returned_for_Correction;
    }

    // ACID transaction guarantees database updates and ledger entries execute atomically
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

    return NextResponse.json(
      { success: true, data: transactionResult },
      { status: 200 }
    );

  } catch (error: any) {
    console.error("CRITICAL REQUISITION SYSTEM TRACE FAILURE:", error);
    return NextResponse.json(
      { error: "CRITICAL STORAGE CORE ERROR: Execution failure encountered during atomic state mutation parsing." },
      { status: 500 }
    );
  }
}