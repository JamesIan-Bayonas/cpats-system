// src/app/api/pr/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PRStatus, Role } from '@prisma/client';
import { prisma } from '@/shared/prisma';
import { CreatePRSchema } from '@/validation/pr.schema';
import { authorizeRequest } from '@/shared/rbac';

export async function POST(request: NextRequest) {
  try {
    const auth = await authorizeRequest(request, Role.Requesting_Office);
    if (!auth.success) return auth.response;
    const activeUser = auth.user;

    const rawBody = await request.json();
    const validation = CreatePRSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, errors: validation.error.format() },
        { status: 422 }
      );
    }

    const { justification, isDirectPoBypass, adminProofFilePath, items } = validation.data;

    // Fast-Track Business Office & Admin Recording Workflow:
    // Requisitions with Pre-Approved Letters enter Pending_Business_Approval to guarantee an auditable digital trail
    const initialStatus = PRStatus.Pending_Business_Approval;

    const executionResult = await prisma.$transaction(async (tx) => {
      const newPR = await tx.purchaseRequest.create({
        data: {
          departmentId: activeUser.departmentId,
          creatorId: activeUser.id,
          justification: justification,
          isDirectPoBypass: isDirectPoBypass,
          adminProofFilePath: isDirectPoBypass ? adminProofFilePath : null,
          status: initialStatus,
          itemsPayload: items,
        },
      });

      await tx.auditLog.create({
        data: {
          prId: newPR.id,
          actorId: activeUser.id,
          previousState: null,
          newState: initialStatus,
          remarks: isDirectPoBypass
            ? `Requisition initialized with Executive Pre-Approved Letter attached [${adminProofFilePath}]. Dispatched to Business Office for fast-track fiscal recording and audit logging.`
            : "Purchase request created and submitted to Business Office for evaluation.",
        },
      });

      return newPR;
    });

    return NextResponse.json({ success: true, data: executionResult }, { status: 201 });
  } catch (error: unknown) {
    console.error("CRITICAL BACKEND FAILURE:", error);
    return NextResponse.json({ success: false, error: "Internal Server Execution Failure" }, { status: 500 });
  }
}