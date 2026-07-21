// prisma/seed.ts
import { prisma } from '../src/shared/prisma';
import { Role } from '@prisma/client';

async function main() {
  console.log("Purging historical sandbox tables...");
  await prisma.auditLog.deleteMany({});
  await prisma.receivingReport.deleteMany({});
  await prisma.purchaseOrder.deleteMany({});
  await prisma.purchaseRequest.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.department.deleteMany({});

  console.log("Seeding institutional departments...");
  
  const ccs = await prisma.department.create({
    data: { id: "f81d4fae-7dec-11d0-a765-00a0c91e6bf6", name: 'College of Computer Studies', code: 'CCS' }
  });

  const finance = await prisma.department.create({
    data: { id: "business-finance-dept-xyz", name: 'Business and Finance Office', code: 'BFO' }
  });

  const admin = await prisma.department.create({
    data: { id: "administration-dept-uuid-hq", name: 'Office of the Vice President for Administration', code: 'OVPA' }
  });

  const purchasing = await prisma.department.create({
    data: { id: "purchasing-dept-uuid-wxy", name: 'Purchasing and Procurement Office', code: 'PPO' }
  });

  const assets = await prisma.department.create({
    data: { id: "asset-management-dept-uuid-000", name: 'Property and Asset Management Unit', code: 'PAMU' }
  });

  const audit = await prisma.department.create({
    data: { id: "audit-compliance-dept-uuid", name: 'Internal Audit Office', code: 'IAO' }
  });

  console.log("Seeding authoritative prototype testing profiles...");

  // 1. Step 1: Requesting Office User
  await prisma.user.create({
    data: {
      id: "6a2f7b1e-3c9d-4e5f-a6b7-8c9d0e1f2a3b",
      email: 'requester@dmc.edu.ph',
      passwordHash: '$2b$10$NKjW8Ex.VExV2oK4WcZqfe8B',
      role: Role.Requesting_Office,
      departmentId: ccs.id
    }
  });

  // 2. Step 2 & Step 4-B: Business Office User
  await prisma.user.create({
    data: {
      id: "business-evaluator-uuid-999",
      email: 'finance@dmc.edu.ph',
      passwordHash: '$2b$10$NKjW8Ex.VExV2oK4WcZqfe8B',
      role: Role.Business_Office,
      departmentId: finance.id
    }
  });

  // 3. Step 3: Admin Office User
  await prisma.user.create({
    data: {
      id: "admin-approver-uuid-static-789",
      email: 'vp-admin@dmc.edu.ph',
      passwordHash: '$2b$10$NKjW8Ex.VExV2oK4WcZqfe8B',
      role: Role.Admin_Office,
      departmentId: admin.id
    }
  });

  // 4. Step 4-A: Purchasing Office User
  await prisma.user.create({
    data: {
      id: "purchaser-uuid-static-888",
      email: 'purchasing@dmc.edu.ph',
      passwordHash: '$2b$10$NKjW8Ex.VExV2oK4WcZqfe8B',
      role: Role.Purchasing_Office,
      departmentId: purchasing.id
    }
  });

  // 5. Step 5: Receiving Custodian User
  await prisma.user.create({
    data: {
      id: "custodian-uuid-static-555",
      email: 'custodian@dmc.edu.ph',
      passwordHash: '$2b$10$NKjW8Ex.VExV2oK4WcZqfe8B',
      role: Role.Receiving_Custodian,
      departmentId: assets.id
    }
  });

  // 6. Global Auditor User
  await prisma.user.create({
    data: {
      id: "global-auditor-uuid-007",
      email: 'auditor@dmc.edu.ph',
      passwordHash: '$2b$10$NKjW8Ex.VExV2oK4WcZqfe8B',
      role: Role.Global_Auditor,
      departmentId: audit.id
    }
  });

  console.log("Ecosystem synced. All prototype role permissions are authenticated within the database cluster.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });