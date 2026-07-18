// File Path: src/app/api/pr/evaluate-business/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, PRStatus, Role } from '@prisma/client';
import { BusinessEvaluationSchema } from '@/validation/business.schema';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    // 1. IDENTITY AND ROLE MATRIX VERIFICATION
    // Mocked context representing Node 24 architectural baseline session state.
    // Replace with token parsing mechanism from JWT/Session middleware cookies.
    const activeUser = {
      id: "business-evaluator-uuid-999", 
      role: Role.Business_Office,
      departmentId: "business-finance-dept-xyz"
    };

    // Strict RBAC Intercept Block
    if (activeUser.role !== Role.Business_Office) {
      return NextResponse.json(
        { error: "FORBIDDEN: Insufficient clearance matrix level. Action restricted to Business Office personnel." },
        { status: 403 }
      );
    }

    // 2. RUNTIME INBOUND PAYLOAD VALIDATION
    const rawBody = await request.json();
    const validation = BusinessEvaluationSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { errors: validation.error.format() },
        { status: 422 }
      );
    }

    const { prId, action, remarks } = validation.data;

    // 3. ATOMIC ISOLATION AND STATE VERIFICATION LOOP
    // Retrieve tracking flags prior to transaction allocation to prevent out-of-order execution states.
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

    // Assert that target record matches Step 2 baseline entry parameters
    if (currentPR.status !== PRStatus.Pending_Business_Approval) {
      return NextResponse.json(
        { error: `INVALID OPERATION STATE: Target request is currently locked in '${currentPR.status}' state and cannot accept Business Office evaluation transitions.` },
        { status: 400 }
      );
    }

    // Mapping discrete input choices to deterministic database system states
    let nextState: PRStatus;
    if (action === 'APPROVE') {
      nextState = PRStatus.Pending_Admin_Approval;
    } else if (action === 'DECLINE') {
      nextState = PRStatus.Declined;
    } else {
      nextState = PRStatus.Returned_for_Correction;
    }

    // 4. ATOMIC DATABASE TRANSACTION ENFORCEMENT
    const transactionResult = await prisma.$transaction(async (tx) => {
      // Mutate status on the target row
      const updatedRequest = await tx.purchaseRequest.update({
        where: { id: prId },
        data: { status: nextState }
      });

      // Inject tracking log into the immutable historical ledger block
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

    // Output valid database transition footprint back to presentation runtime
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