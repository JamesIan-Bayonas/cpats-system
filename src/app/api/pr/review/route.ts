import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, PRStatus, Role } from '@prisma/client';
import { ReviewPRSchema } from '@/validation/review.schema';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    // 1. SECURITY CONTEXT ENFORCEMENT
    // Context mapping simulating stateless session state extraction (Node 24 Baseline)
    // Production implementations must extract credentials directly from verified JWT/Session primitives
    const activeUser = {
      id: "reviewer-uuid-static-456",
      role: Role.Business_Office, // Mutate to Role.Admin_Office or Role.Requesting_Office to test corresponding execution gates
      departmentId: "finance-department-uuid-xyz"
    };

    // 2. PAYLOAD PARSING AND SCHEMA VALIDATION
    const rawBody = await request.json();
    const validation = ReviewPRSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, errors: validation.error.format() },
        { status: 422 }
      );
    }

    const { prId, action, remarks, adminProofFilePath } = validation.data;

    // 3. ATOMIC TRANSACTION & ENCAPSULATED STATE MACHINE
    const executionResult = await prisma.$transaction(async (tx) => {
      // Fetch target record with pessimistic check constraints
      const currentPR = await tx.purchaseRequest.findUnique({
        where: { id: prId }
      });

      if (!currentPR) {
        throw new Error("TARGET_NOT_FOUND");
      }

      const previousState = currentPR.status;
      let newState: PRStatus;

      // WORKFLOW STATE TRANSITION MATRIX VALIDATION
      switch (activeUser.role) {
        case Role.Requesting_Office:
          if (action !== 'SUBMIT') {
            throw new Error("INVALID_ACTION_FOR_ROLE");
          }
          if (previousState !== PRStatus.Draft && previousState !== PRStatus.Returned_for_Correction) {
            throw new Error("INVALID_STATE_TRANSITION");
          }
          if (currentPR.creatorId !== activeUser.id) {
            throw new Error("OWNERSHIP_VIOLATION");
          }
          newState = PRStatus.Pending_Business_Approval;
          break;

        case Role.Business_Office:
          if (previousState !== PRStatus.Pending_Business_Approval) {
            throw new Error("INVALID_STATE_TRANSITION");
          }
          if (action === 'APPROVE') {
            newState = PRStatus.Pending_Admin_Approval;
          } else if (action === 'DECLINE') {
            newState = PRStatus.Declined;
          } else if (action === 'RETURN_FOR_CORRECTION') {
            newState = PRStatus.Returned_for_Correction;
          } else {
            throw new Error("INVALID_ACTION_FOR_ROLE");
          }
          break;

        case Role.Admin_Office:
          if (previousState !== PRStatus.Pending_Admin_Approval) {
            throw new Error("INVALID_STATE_TRANSITION");
          }
          if (action === 'APPROVE') {
            newState = PRStatus.Approved_Awaiting_PO;
          } else if (action === 'DECLINE') {
            newState = PRStatus.Declined;
          } else if (action === 'RETURN_FOR_CORRECTION') {
            newState = PRStatus.Returned_for_Correction;
          } else {
            throw new Error("INVALID_ACTION_FOR_ROLE");
          }
          break;

        default:
          throw new Error("ROLE_UNAUTHORIZED");
      }

      // 4. PERSIST MUTATED STATE ENTIY
      const updatedPR = await tx.purchaseRequest.update({
        where: { id: prId },
        data: {
          status: newState,
          adminProofFilePath: activeUser.role === Role.Admin_Office && adminProofFilePath ? adminProofFilePath : currentPR.adminProofFilePath
        }
      });

      // 5. WRITE TO IMMUTABLE AUDIT LEDGER
      await tx.auditLog.create({
        data: {
          prId: updatedPR.id,
          actorId: activeUser.id,
          previousState: previousState,
          newState: newState,
          remarks: `Action [${action}] applied by Actor [${activeUser.id}] under Role [${activeUser.role}]. Reason: ${remarks}`
        }
      });

      return updatedPR;
    });

    return NextResponse.json(
      { success: true, data: executionResult },
      { status: 200 }
    );

  } catch (error: any) {
    // CENTRALIZED ERROR INTERCEPTOR INTERACTION
    switch (error.message) {
      case "TARGET_NOT_FOUND":
        return NextResponse.json({ success: false, error: "The specified Purchase Request entity does not exist." }, { status: 404 });
      case "ROLE_UNAUTHORIZED":
      case "OWNERSHIP_VIOLATION":
        return NextResponse.json({ success: false, error: "Security Exception: Role credentials insufficient to modify this resource." }, { status: 403 });
      case "INVALID_ACTION_FOR_ROLE":
        return NextResponse.json({ success: false, error: "Architectural Exception: The requested workflow manipulation vector is forbidden for this execution node." }, { status: 400 });
      case "INVALID_STATE_TRANSITION":
        return NextResponse.json({ success: false, error: "State Transition Error: The record cannot proceed from its current operational checkpoint." }, { status: 409 });
      default:
        console.error("SYSTEM CRITICAL FAILURE EXCEPTION:", error);
        return NextResponse.json({ success: false, error: "Internal Server Execution Fault. Transaction safely rolled back." }, { status: 500 });
    }
  }
}