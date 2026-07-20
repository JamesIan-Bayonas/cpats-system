// src/__tests__/schema.test.ts
import { PrismaClient, Role, PRStatus, ConditionNote } from '@prisma/client';

const prisma = new PrismaClient();

describe('CPATS Persistent Schema Constraint Integration Tests', () => {
  let mockDeptId: string;
  let mockUserId: string;
  let mockPRId: string;
  let mockPOId: string;

  beforeAll(async () => {
    // Purge sandbox environment
    await prisma.auditLog.deleteMany({});
    await prisma.receivingReport.deleteMany({});
    await prisma.purchaseOrder.deleteMany({});
    await prisma.purchaseRequest.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.department.deleteMany({});

    // Seed foundation entity dependencies
    const dept = await prisma.department.create({
      data: { name: 'Audit Compliance Unit', code: 'ACU' },
    });
    mockDeptId = dept.id;

    const user = await prisma.user.create({
      data: {
        email: 'governor@dmc.edu.ph',
        passwordHash: '$2b$10$NKjW8Ex.VExV2oK4WcZqfe8B',
        role: Role.Requesting_Office,
        departmentId: mockDeptId,
      },
    });
    mockUserId = user.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('Execution Phase 1: Create PurchaseRequest with structural JSON fields', async () => {
    const pr = await prisma.purchaseRequest.create({
      data: {
        departmentId: mockDeptId,
        creatorId: mockUserId,
        justification: 'Procurement of field inspection terminals.',
        status: PRStatus.Draft,
        itemsPayload: [
          { itemName: 'Handheld QR Scanner Device', quantity: 2, unitPrice: 4500.00 }
        ],
      },
    });

    expect(pr.id).toBeDefined();
    expect(pr.status).toBe(PRStatus.Draft);
    mockPRId = pr.id;
  });

  test('Execution Phase 2: Create PurchaseOrder containing unique qrCodeToken binding', async () => {
    const tokenPayload = `PO-TOKEN-${crypto.randomUUID()}`;
    
    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber: 'PO-2026-0001',
        purchaseRequestId: mockPRId,
        qrCodeToken: tokenPayload,
        isCheckIssued: false,
      },
    });

    expect(po.id).toBeDefined();
    expect(po.qrCodeToken).toBe(tokenPayload);
    mockPOId = po.id;

    // Assert unique index enforcement policy
    await expect(
      prisma.purchaseOrder.create({
        data: {
          poNumber: 'PO-2026-0002',
          purchaseRequestId: mockPRId,
          qrCodeToken: tokenPayload, // Intentionally duplicated token to trigger error
        },
      })
    ).rejects.toThrow();
  });

  test('Execution Phase 3: Commit ReceivingReport containing strict image asset proof tracking links', async () => {
    const report = await prisma.receivingReport.create({
      data: {
        purchaseOrderId: mockPOId,
        condition: ConditionNote.Good,
        invoiceFilePath: '/storage/invoices/INV-9982.pdf',
        asssetImageFilePath: '/storage/assets/proof-hardware-scan.jpg',
        remarks: 'Item package verified undamaged by receiving node.',
      },
    });

    expect(report.id).toBeDefined();
    expect(report.asssetImageFilePath).toBe('/storage/assets/proof-hardware-scan.jpg');
    expect(report.condition).toBe(ConditionNote.Good);
  });
});