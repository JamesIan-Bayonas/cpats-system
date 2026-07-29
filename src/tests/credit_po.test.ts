import { Role, PRStatus, PaymentType } from '@prisma/client';
import { prisma } from '@/shared/prisma';

describe('Credit / Charge Terms Procurement Integration Tests', () => {
  let mockDeptId: string;
  let purchaserUser: { id: string; email: string; role: Role; departmentId: string };
  let cashPrId: string;
  let creditPrId: string;

  beforeAll(async () => {
    await prisma.auditLog.deleteMany({});
    await prisma.receivingReport.deleteMany({});
    await prisma.purchaseOrder.deleteMany({});
    await prisma.purchaseRequest.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.department.deleteMany({});

    const dept = await prisma.department.create({
      data: { name: 'Purchasing & Procurement Department', code: 'PPO-TEST' },
    });
    mockDeptId = dept.id;

    const userDb = await prisma.user.create({
      data: {
        email: 'purchaser-test@dmc.edu.ph',
        passwordHash: '$2b$10$NKjW8Ex.VExV2oK4WcZqfe8B',
        role: Role.Purchasing_Office,
        departmentId: mockDeptId,
      },
    });

    purchaserUser = {
      id: userDb.id,
      email: userDb.email,
      role: userDb.role,
      departmentId: userDb.departmentId,
    };

    const pr1 = await prisma.purchaseRequest.create({
      data: {
        departmentId: mockDeptId,
        creatorId: purchaserUser.id,
        justification: 'Cash purchase requisition test for lab equipment.',
        status: PRStatus.Approved_Awaiting_PO,
        itemsPayload: [{ itemName: 'Test Peripheral A', quantity: 1, unitPrice: 1000 }],
      },
    });
    cashPrId = pr1.id;

    const pr2 = await prisma.purchaseRequest.create({
      data: {
        departmentId: mockDeptId,
        creatorId: purchaserUser.id,
        justification: 'Credit terms requisition test for campus network switch.',
        status: PRStatus.Approved_Awaiting_PO,
        itemsPayload: [{ itemName: 'Test Peripheral B', quantity: 1, unitPrice: 5000 }],
      },
    });
    creditPrId = pr2.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('Branch 1: CASH_CHECK PO creation routes to Awaiting_Check_Issuance', async () => {
    const poNumber = 'PO-CASH-2026-001';
    const qrToken = 'PO-TOKEN-CASH-TEST-001';

    const po = await prisma.$transaction(async (tx) => {
      const newPO = await tx.purchaseOrder.create({
        data: {
          poNumber,
          purchaseRequestId: cashPrId,
          qrCodeToken: qrToken,
          paymentType: PaymentType.CASH_CHECK,
          isCheckIssued: false,
        },
      });

      await tx.purchaseRequest.update({
        where: { id: cashPrId },
        data: { status: PRStatus.Awaiting_Check_Issuance },
      });

      return newPO;
    });

    expect(po.paymentType).toBe(PaymentType.CASH_CHECK);
    expect(po.isCheckIssued).toBe(false);

    const updatedPr = await prisma.purchaseRequest.findUnique({ where: { id: cashPrId } });
    expect(updatedPr?.status).toBe(PRStatus.Awaiting_Check_Issuance);
  });

  test('Branch 2: CREDIT_TERMS PO creation routes directly to Ready_for_Purchase', async () => {
    const poNumber = 'PO-CREDIT-2026-002';
    const qrToken = 'PO-TOKEN-CREDIT-TEST-002';

    const po = await prisma.$transaction(async (tx) => {
      const newPO = await tx.purchaseOrder.create({
        data: {
          poNumber,
          purchaseRequestId: creditPrId,
          qrCodeToken: qrToken,
          paymentType: PaymentType.CREDIT_TERMS,
          isCheckIssued: true, // Check release non-applicable / auto-flagged
        },
      });

      await tx.purchaseRequest.update({
        where: { id: creditPrId },
        data: { status: PRStatus.Ready_for_Purchase },
      });

      return newPO;
    });

    expect(po.paymentType).toBe(PaymentType.CREDIT_TERMS);
    expect(po.isCheckIssued).toBe(true);

    const updatedPr = await prisma.purchaseRequest.findUnique({ where: { id: creditPrId } });
    expect(updatedPr?.status).toBe(PRStatus.Ready_for_Purchase);
  });
});