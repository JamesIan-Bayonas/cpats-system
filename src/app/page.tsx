// File: src/app/page.tsx
import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/shared/session';

export default async function RootPage() {
  const user = await getAuthenticatedUser();

  // If already signed in, dispatch to their role workspace; otherwise force to official login
  if (user) {
    redirect('/dashboard');
  } else {
    redirect('/login');
  }
}