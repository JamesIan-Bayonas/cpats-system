// File: src/app/dashboard/page.tsx
import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/shared/session';
import { Role } from '@prisma/client';

export default async function DashboardDispatcherPage() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect('/login');
  }

  // Automatically dispatch the user to their authorized operational workspace
  switch (user.role) {
    case Role.Requesting_Office:
      redirect('/dashboard/pr/new');
    case Role.Business_Office:
      redirect('/dashboard/pr/evaluate-business');
    case Role.Admin_Office:
      redirect('/dashboard/pr/approve-admin');
    case Role.Purchasing_Office:
      redirect('/dashboard/po/new');
    case Role.Receiving_Custodian:
      redirect('/dashboard/receiving/new');
    case Role.Global_Auditor:
      redirect('/dashboard/audit');
    default:
      redirect('/login');
  }
}