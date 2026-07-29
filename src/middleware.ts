// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/shared/session';
import { ROUTE_ROLE_MAP, isRoleAllowed } from '@/shared/rbac';

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/favicon.ico', '/_next'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    if (pathname === '/login') {
      const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
      const user = sessionCookie ? await verifySessionToken(sessionCookie) : null;
      if (user) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const user = sessionCookie ? await verifySessionToken(sessionCookie) : null;

  if (pathname.startsWith('/dashboard')) {
    if (!user) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Page-Level RBAC Access Control
    const requiredRoles = ROUTE_ROLE_MAP[pathname];
    if (requiredRoles && !isRoleAllowed(user.role, requiredRoles)) {
      return NextResponse.redirect(new URL('/dashboard?error=unauthorized_role', request.url));
    }
  }

  if (pathname.startsWith('/api') && !pathname.startsWith('/api/auth/login')) {
    if (!user) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED: Valid session required." },
        { status: 401 }
      );
    }
  }

  const requestHeaders = new Headers(request.headers);
  if (user) {
    requestHeaders.set('x-user-id', user.id);
    requestHeaders.set('x-user-email', user.email);
    requestHeaders.set('x-user-role', user.role);
    requestHeaders.set('x-user-department-id', user.departmentId);
    requestHeaders.set('x-user-department-code', user.departmentCode);
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*', '/login'],
};  