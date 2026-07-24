import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/shared/session';

export async function GET(request: NextRequest) {
  const activeUser = await getAuthenticatedUser(request);

  if (!activeUser) {
    return NextResponse.json(
      { success: false, error: "UNAUTHORIZED: No active session detected." },
      { status: 401 }
    );
  }

  return NextResponse.json(
    { success: true, data: activeUser },
    { status: 200 }
  );
}