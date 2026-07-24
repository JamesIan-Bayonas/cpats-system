// src/__tests__/schema.test.ts
import { Role, PRStatus, ConditionNote } from '@prisma/client';
import { prisma } from '@/shared/prisma'; // Core Correction: Enforcing Custom MariaDB Adapter Context to Prevent Binary Binary Crashes

describe('CPATS End-to-End Enterprise Procurement Workflow Integration Tests', () => {
  let mockDeptId: string;
  let mockRequesterId: string;
  let mockBusinessEvaluatorId: string;
  let mockAdminApproverId: string;
  let mockPurchaserId: string;
  let mockCustodianId: string;
  
  let targetPRId: string;
  let targetPOId: string;

  beforeAll(async () => {
    // Purge sandbox database tracking tables cleanly to establish deterministic evaluation states
    await prisma.auditLog.deleteMany({});
    await prisma.receivingReport.deleteMany({});
    await prisma.purchaseOrder.deleteMany({});
    await prisma.purchaseRequest.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.department.deleteMany({});

    // Provision Core Institutional Department Node
    const department = await prisma.department.create({
      data: { name: 'College of Computer Studies', code: 'CCS' },
    });
    mockDeptId = department.id;

    // Provision Dedicated Operational RBAC User Profiles
    const requester = await prisma.user.create({
      data: {
        email: 'requester@dmc.edu.ph',
        passwordHash: '$2b$10$NKjW8Ex.VExV2oK4WcZqfe8B',
        role: Role.Requesting_Office,
        departmentId: mockDeptId,
      },
    });
    mockRequesterId = requester.id;

    const businessEvaluator = await prisma.user.create({
      data: {
        email: 'finance@dmc.edu.ph',
        passwordHash: '$2b$10$NKjW8Ex.VExV2oK4WcZqfe8B',
        role: Role.Business_Office,
        departmentId: mockDeptId,
      },
    });
    mockBusinessEvaluatorId = businessEvaluator.id;

    const adminApprover = await prisma.user.create({
      data: {
        email: 'vp-admin@dmc.edu.ph',
        passwordHash: '$2b$10$NKjW8Ex.VExV2oK4WcZqfe8B',
        role: Role.Admin_Office,
        departmentId: mockDeptId,
      },
    });
    mockAdminApproverId = adminApprover.id;

    const purchaser = await prisma.user.create({
      data: {
        email: 'purchasing@dmc.edu.ph',
        passwordHash: '$2b$10$NKjW8Ex.VExV2oK4WcZqfe8B',
        role: Role.Purchasing_Office,
        departmentId: mockDeptId,
      },
    });
    mockPurchaserId = purchaser.id;

    const custodian = await prisma.user.create({
      data: {
        email: 'custodian@dmc.edu.ph',
        passwordHash: '$2b$10$NKjW8Ex.VExV2oK4WcZqfe8B',
        role: Role.Receiving_Custodian,
        departmentId: mockDeptId,
      },
    });
    mockCustodianId = custodian.id;
  });

  afterAll(async () => {
    // Terminate shared pool connection bindings gracefully
    await prisma.$disconnect();
  });

  test('Execution Phase 1: Initialize Requisition to Draft Mode', async () => {
    const pr = await prisma.purchaseRequest.create({
      data: {
        departmentId: mockDeptId,
        creatorId: mockRequesterId,
        justification: 'Procurement of tracking terminals for CCS laboratory inventory controls.',
        status: PRStatus.Draft,
        isDirectPoBypass: false,
        itemsPayload: [
          { itemName: 'Logitech C922 Webcam Pro', quantity: 5, unitPrice: 5200.00 },
          { itemName: 'Handheld USB QR Matrix Scanner', quantity: 3, unitPrice: 3100.00 }
        ],
      },
    });

    expect(pr.id).toBeDefined();
    expect(pr.status).toBe(PRStatus.Draft);
    expect(pr.isDirectPoBypass).toBe(false);
    
    targetPRId = pr.id;

    // Log tracking row inside the immutable ledger
    await prisma.auditLog.create({
      data: {
        prId: targetPRId,
        actorId: mockRequesterId,
        previousState: null,
        newState: PRStatus.Draft,
        remarks: 'Purchase request initialized successfully in Draft mode via integration verification pipeline.'
      }
    });
  });

  test('Execution Phase 2: Advance Requisition to Pending Business Approval', async () => {
    const updatedPR = await prisma.purchaseRequest.update({
      where: { id: targetPRId },
      data: { status: PRStatus.Pending_Business_Approval }
    });

    const log = await prisma.auditLog.create({
      data: {
        prId: targetPRId,
        actorId: mockRequesterId,
        previousState: PRStatus.Draft,
        newState: PRStatus.Pending_Business_Approval,
        remarks: 'Requester dispatched document forward down the workflow trajectory.'
      }
    });

    expect(updatedPR.status).toBe(PRStatus.Pending_Business_Approval);
    expect(log.id).toBeDefined();
  });

  test('Execution Phase 3: Execute Business Office Evaluation Review', async () => {
    const currentPR = await prisma.purchaseRequest.findUnique({
      where: { id: targetPRId }
    });

    expect(currentPR?.status).toBe(PRStatus.Pending_Business_Approval);

    const updatedPR = await prisma.purchaseRequest.update({
      where: { id: targetPRId },
      data: { status: PRStatus.Pending_Admin_Approval }
    });

    await prisma.auditLog.create({
      data: {
        prId: targetPRId,
        actorId: mockBusinessEvaluatorId,
        previousState: PRStatus.Pending_Business_Approval,
        newState: PRStatus.Pending_Admin_Approval,
        remarks: 'Necessity verified and budget code allocations approved by Business Office Node.'
      }
    });

    expect(updatedPR.status).toBe(PRStatus.Pending_Admin_Approval);
  });

  test('Execution Phase 4: Execute Admin Office Authoritative Sign-off', async () => {
    const updatedPR = await prisma.purchaseRequest.update({
      where: { id: targetPRId },
      data: { 
        status: PRStatus.Approved_Awaiting_PO,
        adminProofFilePath: 'https://storage.dmc.edu.ph/compliance/proofs/exec-auth-ccs-99.pdf'
      }
    });

    await prisma.auditLog.create({
      data: {
        prId: targetPRId,
        actorId: mockAdminApproverId,
        previousState: PRStatus.Pending_Admin_Approval,
        newState: PRStatus.Approved_Awaiting_PO,
        remarks: 'Option 1 confirmation verified. Executive checks passed. Authorized to structure Purchase Order.'
      }
    });

    expect(updatedPR.status).toBe(PRStatus.Approved_Awaiting_PO);
    expect(updatedPR.adminProofFilePath).toBe('https://storage.dmc.edu.ph/compliance/proofs/exec-auth-ccs-99.pdf');
  });

  test('Execution Phase 5: Bind PurchaseOrder Entity and Generate Cryptographic Token', async () => {
    const uniqueTokenPayload = `PO-TOKEN-${crypto.randomUUID()}`;
    
    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber: 'PO-2026-8891',
        purchaseRequestId: targetPRId,
        qrCodeToken: uniqueTokenPayload,
        isCheckIssued: false,
      },
    });

    expect(po.id).toBeDefined();
    expect(po.isCheckIssued).toBe(false);
    targetPOId = po.id;

    // Advance requisition path state
    await prisma.purchaseRequest.update({
      where: { id: targetPRId },
      data: { status: PRStatus.Awaiting_Check_Issuance }
    });

    await prisma.auditLog.create({
      data: {
        prId: targetPRId,
        actorId: mockPurchaserId,
        previousState: PRStatus.Approved_Awaiting_PO,
        newState: PRStatus.Awaiting_Check_Issuance,
        remarks: `Purchase Order document printed and bound under poNumber: PO-2026-8891.`
      }
    });

    // Enforce Table Relational Guardrails: Reject duplicate qrCodeTokens
    await expect(
      prisma.purchaseOrder.create({
        data: {
          poNumber: 'PO-2026-8892',
          purchaseRequestId: targetPRId,
          qrCodeToken: uniqueTokenPayload,
        },
      })
    ).rejects.toThrow();
  });

  test('Execution Phase 6: Authorize Bank Check Release Verification Lock', async () => {
    const poRecord = await prisma.purchaseOrder.findUnique({
      where: { id: targetPOId }
    });

    expect(poRecord?.isCheckIssued).toBe(false);

    // Update check release flag states within database models
    await prisma.purchaseOrder.update({
      where: { id: targetPOId },
      data: { isCheckIssued: true }
    });

    const advancedPR = await prisma.purchaseRequest.update({
      where: { id: targetPRId },
      data: { status: PRStatus.Ready_for_Purchase }
    });

    await prisma.auditLog.create({
      data: {
        prId: targetPRId,
        actorId: mockBusinessEvaluatorId,
        previousState: PRStatus.Awaiting_Check_Issuance,
        newState: PRStatus.Ready_for_Purchase,
        remarks: 'Physical bank check released (Ref Code: CHK-990112). Core allocation balance drawn.'
      }
    });

    expect(advancedPR.status).toBe(PRStatus.Ready_for_Purchase);
  });

  test('Execution Phase 7: Log Cargo Intake Receiving Report and Finalize Requisition Pipeline', async () => {
    const report = await prisma.receivingReport.create({
      data: {
        purchaseOrderId: targetPOId,
        condition: ConditionNote.Good,
        invoiceFilePath: '/storage/invoices/CCS-INV-9821.pdf',
        asssetImageFilePath: '/storage/assets/proof-ccs-hardware.jpg',
        remarks: 'Shipping manifest checked. Quantities match perfectly. Hardware undamaged.',
      },
    });

    const finalizedPR = await prisma.purchaseRequest.update({
      where: { id: targetPRId },
      data: { status: PRStatus.Received_and_Closed }
    });

    const finalAuditTrail = await prisma.auditLog.create({
      data: {
        prId: targetPRId,
        actorId: mockCustodianId,
        previousState: PRStatus.Ready_for_Purchase,
        newState: PRStatus.Received_and_Closed,
        remarks: 'Hardware inspection logs persisted. System tracking record closed cleanly.'
      }
    });

    expect(report.id).toBeDefined();
    expect(report.condition).toBe(ConditionNote.Good);
    expect(finalizedPR.status).toBe(PRStatus.Received_and_Closed);
    expect(finalAuditTrail.newState).toBe(PRStatus.Received_and_Closed);
  });
});