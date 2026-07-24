import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/shared/session';

export async function POST() {
  const response = NextResponse.json(
    { success: true, message: "Session successfully terminated." },
    { status: 200 }
  );

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    expires: new Date(0),
    path: '/',
  });

  return response;
}