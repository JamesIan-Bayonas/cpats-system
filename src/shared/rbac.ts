import { NextRequest, NextResponse } from 'next/server';
import { Role } from '@prisma/client';
import { getAuthenticatedUser, AuthUser } from '@/shared/session';

export const ROUTE_ROLE_MAP: Record<string, Role[]> = {
  '/dashboard/pr/new': [Role.Requesting_Office],
  '/dashboard/pr/track': [Role.Requesting_Office],
  '/dashboard/pr/evaluate-business': [Role.Business_Office],
  '/dashboard/pr/approve-admin': [Role.Admin_Office],
  '/dashboard/po/new': [Role.Purchasing_Office],
  '/dashboard/po/release-check': [Role.Business_Office],
  '/dashboard/receiving/new': [Role.Receiving_Custodian],
  '/dashboard/audit': [Role.Global_Auditor],
};

export function isRoleAllowed(userRole: Role, allowedRoles: Role | Role[]): boolean {
  const allowed = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return allowed.includes(userRole);
}

export async function authorizeRequest(
  request: NextRequest,
  allowedRoles: Role | Role[]
): Promise<
  | { success: true; user: AuthUser }
  | { success: false; response: NextResponse }
> {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, error: "UNAUTHORIZED: Active authenticated session required." },
        { status: 401 }
      ),
    };
  }

  if (!isRoleAllowed(user.role, allowedRoles)) {
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          error: `FORBIDDEN: Institutional security policy restricts resource access. User role '${user.role}' is not authorized for this operation.`,
        },
        { status: 403 }
      ),
    };
  }

  return { success: true, user };
}