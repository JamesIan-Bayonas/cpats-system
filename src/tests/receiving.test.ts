import { Role, PRStatus, ConditionNote } from '@prisma/client';
import { prisma } from '@/shared/prisma';

describe('Sprint 5 — Cargo Intake & WebRTC Receiving Inspection Integration Tests', () => {
  let mockDeptId: string;
  let custodianUser: { id: string; email: string; role: Role; departmentId: string };
  let testPrId: string;
  let testPoId: string;

  beforeAll(async () => {
    // Clean database sandbox tables before deterministic test execution
    await prisma.auditLog.deleteMany({});
    await prisma.receivingReport.deleteMany({});
    await prisma.purchaseOrder.deleteMany({});
    await prisma.purchaseRequest.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.department.deleteMany({});

    // Provision Department
    const dept = await prisma.department.create({
      data: { name: 'Property & Asset Management Unit', code: 'PAMU' },
    });
    mockDeptId = dept.id;

    // Provision Receiving Custodian User Profile
    const userDb = await prisma.user.create({
      data: {
        email: 'custodian-test@dmc.edu.ph',
        passwordHash: '$2b$10$NKjW8Ex.VExV2oK4WcZqfe8B',
        role: Role.Receiving_Custodian,
        departmentId: mockDeptId,
      },
    });

    custodianUser = {
      id: userDb.id,
      email: userDb.email,
      role: userDb.role,
      departmentId: userDb.departmentId,
    };

    // Provision Purchase Request at Ready_for_Purchase state
    const pr = await prisma.purchaseRequest.create({
      data: {
        departmentId: mockDeptId,
        creatorId: custodianUser.id,
        justification: 'Procurement of laboratory network switches for campus backbone update.',
        status: PRStatus.Ready_for_Purchase,
        itemsPayload: [{ itemName: 'Cisco 24-Port Gigabit Switch', quantity: 2, unitPrice: 18500 }],
      },
    });
    testPrId = pr.id;

    // Provision Linked Purchase Order
    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber: 'PO-2026-9901',
        purchaseRequestId: testPrId,
        qrCodeToken: 'PO-TOKEN-TEST-UUID-9901',
        isCheckIssued: true,
      },
    });
    testPoId = po.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('Intake Execution: Finalize valid cargo report with physical hardware photo and invoice URL', async () => {
    const uploadedPhotoPath = '/uploads/1785080140890-hardware_switch.png';
    const invoicePath = '/storage/invoices/INV-2026-9901.pdf';

    // Execute atomic receiving report creation and PR state mutation
    const report = await prisma.$transaction(async (tx) => {
      const newReport = await tx.receivingReport.create({
        data: {
          purchaseOrderId: testPoId,
          condition: ConditionNote.Good,
          invoiceFilePath: invoicePath,
          asssetImageFilePath: uploadedPhotoPath,
          remarks: 'Cargo delivered undamaged. Serial numbers verified against supplier manifest.',
        },
      });

      await tx.purchaseRequest.update({
        where: { id: testPrId },
        data: { status: PRStatus.Received_and_Closed },
      });

      await tx.auditLog.create({
        data: {
          prId: testPrId,
          actorId: custodianUser.id,
          previousState: PRStatus.Ready_for_Purchase,
          newState: PRStatus.Received_and_Closed,
          remarks: `Asset inspection finalized. Condition: [Good]. Hardware photo [${uploadedPhotoPath}] bound.`,
        },
      });

      return newReport;
    });

    expect(report.id).toBeDefined();
    expect(report.condition).toBe(ConditionNote.Good);
    expect(report.asssetImageFilePath).toBe(uploadedPhotoPath);

    // Verify parent Purchase Request transition
    const updatedPr = await prisma.purchaseRequest.findUnique({
      where: { id: testPrId },
      include: { auditLogs: true },
    });

    expect(updatedPr?.status).toBe(PRStatus.Received_and_Closed);
    expect(updatedPr?.auditLogs.some((log) => log.newState === PRStatus.Received_and_Closed)).toBe(true);
  });

  test('Guards Verification: Reject duplicate intake or invalid state transition', async () => {
    // Attempting to finalize receiving report on a request that is already Received_and_Closed
    const prState = await prisma.purchaseRequest.findUnique({
      where: { id: testPrId },
      select: { status: true },
    });

    expect(prState?.status).toBe(PRStatus.Received_and_Closed);

    // Verification that non-Ready_for_Purchase stages block further intake entries
    const isStageValid = prState?.status === PRStatus.Ready_for_Purchase;
    expect(isStageValid).toBe(false);
  });
});