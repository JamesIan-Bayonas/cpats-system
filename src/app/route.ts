// src/app/api/pr/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, PRStatus, Role } from '@prisma/client';
import { CreatePRSchema } from '@/validation/pr.schema.ts';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    // 1. SECURITY CONTEXT (Mocked session management for Node 24 baseline)
    // In production, parse these details securely from your JWT/Session cookie
    const activeUser = {
      id: "user-uuid-from-session-123", 
      role: Role.Requesting_Office,
      departmentId: "some-department-uuid-abc" // e.g., CCS Department
    };

    // RBAC Authorization Block
    if (activeUser.role !== Role.Requesting_Office) {
      return NextResponse.json(
        { error: "Unauthorized. Only Requesting Offices can initiate a purchase request." },
        { status: 403 }
      );
    }

    // 2. PARSE AND VALIDATE PAYLOAD
    const rawBody = await request.json();
    const validation = CreatePRSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { errors: validation.error.format() },
        { status: 422 }
      );
    }

    const { justification, isDirectPoBypass, items } = validation.data;

    // 3. DETERMINISTIC STATE ENGINE MATCHING THE ARCHITECTURAL MANDATE
    // If Direct PO Bypass is true, it skips directly to Approved_Awaiting_PO.
    // Otherwise, it starts safely in the Draft state.
    const initialStatus = isDirectPoBypass 
      ? PRStatus.Approved_Awaiting_PO 
      : PRStatus.Draft;

    // 4. ACID-COMPLIANT DATABASE TRANSACTION
    const executionResult = await prisma.$transaction(async (tx) => {
      
      // Create the core Purchase Request record
      const newPR = await tx.purchaseRequest.create({
        data: {
          departmentId: activeUser.departmentId,
          creatorId: activeUser.id,
          justification: justification,
          isDirectPoBypass: isDirectPoBypass,
          status: initialStatus,
          // MySQL saves this directly as a binary native JSON field types safely
          itemsPayload: items, 
        },
      });

      // Append initial tracking marker to the Immutable Ledger
      await tx.auditLog.create({
        data: {
          prId: newPR.id,
          actorId: activeUser.id,
          previousState: null, // No state before creation
          newState: initialStatus,
          remarks: isDirectPoBypass 
            ? "PR initialized using Executive Authorization Document. System steps bypassed."
            : "Purchase request initialized successfully in Draft mode.",
        },
      });

      return newPR;
    });

    // Return the cleanly formed entity back to our React application layout
    return NextResponse.json(
      { success: true, data: executionResult },
      { status: 201 }
    );

  } catch (error: any) {
    console.error("CRITICAL BACKEND FAILURE:", error);
    return NextResponse.json(
      { error: "Internal Server Execution Failure" },
      { status: 500 }
    );
  }
}