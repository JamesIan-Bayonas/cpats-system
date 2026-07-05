// prisma/seed.ts
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. Clean up existing records
  await prisma.auditLog.deleteMany({});
  await prisma.receivingReport.deleteMany({});
  await prisma.purchaseOrder.deleteMany({});
  await prisma.purchaseRequest.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.department.deleteMany({});

  // 2. Create Departments
  const academicDept = await prisma.department.create({
    data: { name: 'College of Computer Studies', code: 'CCS' }
  });
  const financeDept = await prisma.department.create({
    data: { name: 'Business and Finance Office', code: 'BFO' }
  });
  const adminDept = await prisma.department.create({
    data: { name: 'Office of the Administration', code: 'ADMIN' }
  });

  // 3. Create Users with Exact Roles
  await prisma.user.createMany({
    data: [
      {
        email: 'requester@dmc.edu.ph',
        passwordHash: 'hashed_password_placeholder', // Use bcrypt/argon2 in real production
        role: Role.Requesting_Office,
        departmentId: academicDept.id
      },
      {
        email: 'finance@dmc.edu.ph',
        passwordHash: 'hashed_password_placeholder',
        role: Role.Business_Office,
        departmentId: financeDept.id
      },
      {
        email: 'admin@dmc.edu.ph',
        passwordHash: 'hashed_password_placeholder',
        role: Role.Admin_Office,
        departmentId: adminDept.id
      },
      {
        email: 'auditor@dmc.edu.ph',
        passwordHash: 'hashed_password_placeholder',
        role: Role.Global_Auditor,
        departmentId: adminDept.id
      }
    ]
  });

  console.log("Database seeded successfully with structural roles!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });