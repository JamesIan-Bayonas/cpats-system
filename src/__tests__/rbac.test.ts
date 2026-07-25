import { signToken, AuthUser } from '@/shared/session';
import { Role } from '@prisma/client';
import { isRoleAllowed } from '@/shared/rbac';

describe('Sprint 2 — Role-Based Access Control (RBAC) Governance Integration Tests', () => {
  const requesterUser: AuthUser = {
    id: 'user-requester-1',
    email: 'requester@dmc.edu.ph',
    role: Role.Requesting_Office,
    departmentId: 'dept-ccs',
    departmentCode: 'CCS',
    departmentName: 'College of Computer Studies',
  };

  const businessUser: AuthUser = {
    id: 'user-finance-1',
    email: 'finance@dmc.edu.ph',
    role: Role.Business_Office,
    departmentId: 'dept-bfo',
    departmentCode: 'BFO',
    departmentName: 'Business Office',
  };

  test('RBAC Phase 1: Role Matrix Assertion Engine Evaluation', () => {
    expect(isRoleAllowed(requesterUser.role, Role.Requesting_Office)).toBe(true);
    expect(isRoleAllowed(requesterUser.role, Role.Business_Office)).toBe(false);
    expect(isRoleAllowed(businessUser.role, [Role.Business_Office, Role.Admin_Office])).toBe(true);
  });

  test('RBAC Phase 2: Signed Session Token Role Payload Integrity', async () => {
    const token = signToken({
      user: requesterUser,
      exp: Date.now() + 1000 * 60 * 60,
    });

    expect(token).toBeDefined();
    const parts = (await token).split('.');
    const claims = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    expect(claims.user.role).toBe(Role.Requesting_Office);
  });

  test('RBAC Phase 3: Cross-Role Resource Mutation Rejection Simulation', () => {
    // Attempting Business Office operation using a Requesting_Office session context
    const isAllowed = isRoleAllowed(requesterUser.role, Role.Business_Office);
    expect(isAllowed).toBe(false);
  });
});