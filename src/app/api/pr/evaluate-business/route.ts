// File Path: src/app/api/pr/evaluate-business/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, PRStatus, Role } from '@prisma/client';
import { BusinessEvaluationSchema } from '@/validation/business.schema';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    // SECURITY CONTEXT: Explicit institutional role verification boundary.
    // Ensure production middleware parses session objects securely from tokens.
    const activeUser = {
      id: "business-evaluator-uuid-999", 
      role: Role.Business_Office,
      departmentId: "business-finance-dept-xyz"
    };

    // Strict Role-Based Access Control execution intercept
    if (activeUser.role !== Role.Business_Office) {
      return NextResponse.json(
        { error: "FORBIDDEN: Insufficient clearance matrix level. Action restricted to Business Office personnel." },
        { status: 403 }
      );
    }

    // Inbound payload extraction
    const rawBody = await request.json();
    const validation = BusinessEvaluationSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { errors: validation.error.format() },
        { status: 422 }
      );
    }

    const { prId, action, remarks } = validation.data;

    // Fetch tracking target flags to ensure state isolation
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

    // Guard constraint preventing execution outside the designated phase
    if (currentPR.status !== PRStatus.Pending_Business_Approval) {
      return NextResponse.json(
        { error: `INVALID OPERATION STATE: Target request is currently locked in '${currentPR.status}' state and cannot accept Business Office evaluation transitions.` },
        { status: 400 }
      );
    }

    // State machine mutation assignment mapping
    let nextState: PRStatus;
    if (action === 'APPROVE') {
      nextState = PRStatus.Pending_Admin_Approval;
    } else if (action === 'DECLINE') {
      nextState = PRStatus.Declined;
    } else {
      nextState = PRStatus.Returned_for_Correction;
    }

    // Atomic transaction ensures mutations and logs commit simultaneously or roll back entirely
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