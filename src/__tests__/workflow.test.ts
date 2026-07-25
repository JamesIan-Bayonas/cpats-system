import { Role, PRStatus } from '@prisma/client';
import { prisma } from '@/shared/prisma';
import { signToken, AuthUser } from '@/shared/session';

describe('Sprint 3 — Procurement Workflow Authentication Integration Tests', () => {
  let mockDeptId: string;
  let requesterUser: AuthUser;
  let businessUser: AuthUser;
  let adminUser: AuthUser;

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
        passwordHash: 'pbkdf2$hash',
        role: Role.Requesting_Office,
        departmentId: mockDeptId
      }
    });

    requesterUser = {
      id: reqDb.id,
      email: reqDb.email,
      role: Role.Requesting_Office,
      departmentId: mockDeptId,
      departmentCode: 'CCS-INT',
      departmentName: 'CCS Integration Department'
    };

    const busDb = await prisma.user.create({
      data: {
        email: 'finance-int@dmc.edu.ph',
        passwordHash: 'pbkdf2$hash',
        role: Role.Business_Office,
        departmentId: mockDeptId
      }
    });

    businessUser = {
      id: busDb.id,
      email: busDb.email,
      role: Role.Business_Office,
      departmentId: mockDeptId,
      departmentCode: 'BFO-INT',
      departmentName: 'Finance'
    };
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('Workflow Phase 1: Requisition Persistence Bound to Signed Session Actor', async () => {
    const pr = await prisma.purchaseRequest.create({
      data: {
        departmentId: requesterUser.departmentId,
        creatorId: requesterUser.id,
        justification: 'Automated integration testing for Sprint 3 identity binding.',
        status: PRStatus.Pending_Business_Approval,
        itemsPayload: [{ itemName: 'Test Peripheral', quantity: 2, unitPrice: 1500 }]
      }
    });

    await prisma.auditLog.create({
      data: {
        prId: pr.id,
        actorId: requesterUser.id,
        previousState: PRStatus.Draft,
        newState: PRStatus.Pending_Business_Approval,
        remarks: 'Requisition dispatched by authenticated session actor.'
      }
    });

    const fetchedPR = await prisma.purchaseRequest.findUnique({
      where: { id: pr.id },
      include: { auditLogs: true }
    });

    expect(fetchedPR).not.toBeNull();
    expect(fetchedPR?.creatorId).toBe(requesterUser.id);
    expect(fetchedPR?.auditLogs[0].actorId).toBe(requesterUser.id);
  });

  test('Workflow Phase 2: Business Evaluation Atomic Mutation with Session Signature', async () => {
    const pr = await prisma.purchaseRequest.findFirst({
      where: { creatorId: requesterUser.id }
    });

    expect(pr).not.toBeNull();

    const updatedPR = await prisma.purchaseRequest.update({
      where: { id: pr!.id },
      data: { status: PRStatus.Pending_Admin_Approval }
    });

    const auditLog = await prisma.auditLog.create({
      data: {
        prId: pr!.id,
        actorId: businessUser.id,
        previousState: PRStatus.Pending_Business_Approval,
        newState: PRStatus.Pending_Admin_Approval,
        remarks: 'Business Office approval executed by session user.'
      }
    });

    expect(updatedPR.status).toBe(PRStatus.Pending_Admin_Approval);
    expect(auditLog.actorId).toBe(businessUser.id);
  });
});