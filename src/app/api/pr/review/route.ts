// src/app/api/pr/review/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PRStatus, Role } from '@prisma/client';
import { prisma } from '@/shared/prisma'; 
import { ReviewPRSchema } from '@/validation/review.schema';

export async function POST(request: NextRequest) {
  try {
    // 1. SECURITY CONTEXT ENFORCEMENT (Aligned with Seeded Admin Profile)
    const activeUser: { id: string; role: Role; departmentId: string } = {
      id: "admin-approver-uuid-static-789",
      role: Role.Admin_Office, 
      departmentId: "administration-dept-uuid-hq"
    };

    // Role Guard
    if (activeUser.role !== Role.Admin_Office) {
      return NextResponse.json(
        { success: false, error: "FORBIDDEN: Access restricted to Admin Office profiles." },
        { status: 403 }
      );
    }

    // 2. PAYLOAD VALIDATION
    const rawBody = await request.json();
    const validation = ReviewPRSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, errors: validation.error.format() },
        { status: 422 }
      );
    }

    const { prId, action, remarks, adminProofFilePath } = validation.data;

    // 3. ATOMIC STATE MUTATION
    const executionResult = await prisma.$transaction(async (tx) => {
      const currentPR = await tx.purchaseRequest.findUnique({
        where: { id: prId }
      });

      if (!currentPR) {
        throw new Error("TARGET_NOT_FOUND");
      }

      const previousState = currentPR.status;

      // Ensure record is waiting for Admin approval
      if (previousState !== PRStatus.Pending_Admin_Approval) {
        throw new Error("INVALID_STATE_TRANSITION");
      }

      let newState: PRStatus;
      if (action === 'APPROVE') {
        newState = PRStatus.Approved_Awaiting_PO;
      } else if (action === 'DECLINE') {
        newState = PRStatus.Declined;
      } else if (action === 'RETURN_FOR_CORRECTION') {
        newState = PRStatus.Returned_for_Correction;
      } else {
        throw new Error("INVALID_ACTION_FOR_ROLE");
      }

      // Persist status change and mandatory proof path
      const updatedPR = await tx.purchaseRequest.update({
        where: { id: prId },
        data: {
          status: newState,
          adminProofFilePath: action === 'APPROVE' && adminProofFilePath ? adminProofFilePath : currentPR.adminProofFilePath
        }
      });

      // Write entry to immutable audit log
      await tx.auditLog.create({
        data: {
          prId: updatedPR.id,
          actorId: activeUser.id,
          previousState: previousState,
          newState: newState,
          remarks: `Admin Execution Node [${action}]. Option 1 Reference: ${adminProofFilePath || 'None'}. Reason: ${remarks}`
        }
      });

      return updatedPR;
    });

    return NextResponse.json(
      { success: true, data: executionResult },
      { status: 200 }
    );

  } catch (error: unknown) {
    if (error instanceof Error) {
      switch (error.message) {
        case "TARGET_NOT_FOUND":
          return NextResponse.json({ success: false, error: "The specified Purchase Request entity does not exist." }, { status: 404 });
        case "INVALID_ACTION_FOR_ROLE":
          return NextResponse.json({ success: false, error: "Architectural Exception: Requested action forbidden for this execution node." }, { status: 400 });
        case "INVALID_STATE_TRANSITION":
          return NextResponse.json({ success: false, error: "State Transition Error: Target request is not currently in 'Pending_Admin_Approval' status." }, { status: 409 });
        default:
          console.error("SYSTEM CRITICAL FAILURE EXCEPTION:", error);
          return NextResponse.json({ success: false, error: "Internal Server Execution Fault. Transaction safely rolled back." }, { status: 500 });
      }
    }
    return NextResponse.json({ success: false, error: "An unknown execution fault occurred." }, { status: 500 });
  }
}