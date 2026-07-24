// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/prisma';
import { LoginSchema } from '@/validation/auth.schema';
import { verifyPassword, signToken, SESSION_COOKIE_NAME, AuthUser } from '@/shared/session';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const validation = LoginSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, errors: validation.error.format() },
        { status: 422 }
      );
    }

    const { email, password } = validation.data;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { department: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "AUTHENTICATION_FAILED: Invalid email or password." },
        { status: 401 }
      );
    }

    const isPasswordValid = verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, error: "AUTHENTICATION_FAILED: Invalid email or password." },
        { status: 401 }
      );
    }

    const authUserPayload: AuthUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId,
      departmentCode: user.department.code,
      departmentName: user.department.name,
    };

    // Await async signToken call
    const sessionToken = await signToken({
      user: authUserPayload,
      exp: Date.now() + 1000 * 60 * 60 * 12, // 12-hour session
    });

    const response = NextResponse.json(
      { success: true, data: authUserPayload },
      { status: 200 }
    );

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 12,
    });

    return response;
  } catch (error: unknown) {
    console.error("CRITICAL AUTHENTICATION ENGINE FAILURE:", error);
    return NextResponse.json(
      { success: false, error: "Internal Authentication Exception." },
      { status: 500 }
    );
  }
}