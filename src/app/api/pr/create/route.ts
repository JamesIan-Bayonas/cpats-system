// src/app/api/pr/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PRStatus, Role } from '@prisma/client';
import { prisma } from '@/shared/prisma';
import { CreatePRSchema } from '@/validation/pr.schema';

export async function POST(request: NextRequest) {
  try {
    // SECURITY REALIGNMENT: Mapped to deterministic database rows
    const activeUser = {
      id: "6a2f7b1e-3c9d-4e5f-a6b7-8c9d0e1f2a3b", 
      role: Role.Requesting_Office,
      departmentId: "f81d4fae-7dec-11d0-a765-00a0c91e6bf6"
    };

    if (activeUser.role !== Role.Requesting_Office) {
      return NextResponse.json(
        { error: "Unauthorized. Only Requesting Offices can initiate a purchase request." },
        { status: 403 }
      );
    }

    const rawBody = await request.json();
    const validation = CreatePRSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { errors: validation.error.format() },
        { status: 422 }
      );
    }

    const { justification, isDirectPoBypass, items } = validation.data;
    const initialStatus = isDirectPoBypass ? PRStatus.Approved_Awaiting_PO : PRStatus.Draft;

    const executionResult = await prisma.$transaction(async (tx) => {
      const newPR = await tx.purchaseRequest.create({
        data: {
          departmentId: activeUser.departmentId,
          creatorId: activeUser.id,
          justification: justification,
          isDirectPoBypass: isDirectPoBypass,
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
            ? "PR initialized using Executive Authorization Document. System steps bypassed."
            : "Purchase request initialized successfully in Draft mode.",
        },
      });

      return newPR;
    });

    return NextResponse.json({ success: true, data: executionResult }, { status: 201 });

  } catch (error: unknown) {
    console.error("CRITICAL BACKEND FAILURE:", error);
    return NextResponse.json({ error: "Internal Server Execution Failure" }, { status: 500 });
  }
}