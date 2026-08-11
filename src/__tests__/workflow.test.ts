// src/__tests__/workflow.test.ts
import { Role, PRStatus } from '@prisma/client';
import { prisma } from '@/shared/prisma';

describe('Sprint 3 — Requisition Feedback & Audit Visibility Integration Tests', () => {
  let mockDeptId: string;
  let requesterUser: { id: string; role: Role; departmentId: string };
  let businessUser: { id: string; role: Role; departmentId: string };

  beforeAll(async () => {
    await prisma.auditLog.deleteMany({});
    await prisma.receivingReport.deleteMany({});
    await prisma.purchaseOrder.deleteMany({});
    await prisma.purchaseRequest.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.department.deleteMany({});

    const dept = await prisma.department.create({
      data: { name: 'CCS Integration Department', code: 'CCS-INT' }
    });
    mockDeptId = dept.id;

    const reqDb = await prisma.user.create({
      data: {
        email: 'requester-int@dmc.edu.ph',
        passwordHash: '$2b$10$NKjW8Ex.VExV2oK4WcZqfe8B',
        role: Role.Requesting_Office,
        departmentId: mockDeptId
      }
    });
    requesterUser = { id: reqDb.id, role: reqDb.role, departmentId: reqDb.departmentId };

    const busDb = await prisma.user.create({
      data: {
        email: 'finance-int@dmc.edu.ph',
        passwordHash: '$2b$10$NKjW8Ex.VExV2oK4WcZqfe8B',
        role: Role.Business_Office,
        departmentId: mockDeptId
      }
    });
    businessUser = { id: busDb.id, role: busDb.role, departmentId: busDb.departmentId };
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('Feedback Visibility: Return for Correction remarks written by Business Office are returned in Requesting Office queue audit logs', async () => {
    const returnRemarks = 'Quantity exceeds Q3 departmental allocation cap. Please adjust line items.';

    // 1. Requester creates PR
    const pr = await prisma.purchaseRequest.create({
      data: {
        departmentId: requesterUser.departmentId,
        creatorId: requesterUser.id,
        justification: 'Purchase requisition test for lab peripherals.',
        status: PRStatus.Pending_Business_Approval,
        itemsPayload: [{ itemName: 'Logitech C922 Webcam', quantity: 10, unitPrice: 5200 }]
      }
    });

    // 2. Business Office returns PR for correction with remarks
    await prisma.purchaseRequest.update({
      where: { id: pr.id },
      data: { status: PRStatus.Returned_for_Correction }
    });

    await prisma.auditLog.create({
      data: {
        prId: pr.id,
        actorId: businessUser.id,
        previousState: PRStatus.Pending_Business_Approval,
        newState: PRStatus.Returned_for_Correction,
        remarks: returnRemarks
      }
    });

    // 3. Requesting Office queries queue to inspect audit log feedback
    const reqQueuePR = await prisma.purchaseRequest.findFirst({
      where: { id: pr.id, departmentId: requesterUser.departmentId },
      include: {
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          include: { actor: { select: { email: true, role: true } } }
        }
      }
    });

    expect(reqQueuePR?.status).toBe(PRStatus.Returned_for_Correction);
    expect(reqQueuePR?.auditLogs).toHaveLength(1);
    expect(reqQueuePR?.auditLogs[0].remarks).toBe(returnRemarks);
    expect(reqQueuePR?.auditLogs[0].actor.role).toBe(Role.Business_Office);
  });
});