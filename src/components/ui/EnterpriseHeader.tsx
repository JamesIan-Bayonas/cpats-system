'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Role } from '@prisma/client';

interface EnterpriseHeaderProps {
  activeRole?: Role;
  departmentCode?: string;
}

interface NavigationStep {
  name: string;
  number: string;
  href: string;
  allowedRoles: Role[];
}

const ROLE_LABELS: Record<string, string> = {
  Requesting_Office: 'Requesting Office',
  Business_Office: 'Business Office',
  Admin_Office: 'Admin Office',
  Purchasing_Office: 'Purchasing Office',
  Receiving_Custodian: 'Receiving Custodian',
  Global_Auditor: 'Global Auditor',
};

export default function EnterpriseHeader({ activeRole: propRole, departmentCode: propCode }: EnterpriseHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<{ email: string; role: Role; departmentCode: string } | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((res) => {
        if (res.success && res.data) {
          setSessionUser(res.data);
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    try {
      setSigningOut(true);
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Logout error:', err);
      setSigningOut(false);
    }
  };

  const displayRole = sessionUser?.role || propRole || Role.Requesting_Office;
  const displayCode = sessionUser?.departmentCode || propCode || 'CCS';
  const roleLabel = ROLE_LABELS[displayRole] ?? String(displayRole).replace(/_/g, ' ');
  const initial = roleLabel.charAt(0);

  // Define workflow routes and permitted roles
  const navigationSteps: NavigationStep[] = [
    { name: 'Init PR', number: '01A', href: '/dashboard/pr/new', allowedRoles: [Role.Requesting_Office] },
    { name: 'Track Requests', number: '01B', href: '/dashboard/pr/track', allowedRoles: [Role.Requesting_Office] },
    { name: 'Business Eval', number: '02', href: '/dashboard/pr/evaluate-business', allowedRoles: [Role.Business_Office] },
    { name: 'Admin Sign-Off', number: '03', href: '/dashboard/pr/approve-admin', allowedRoles: [Role.Admin_Office] },
    { name: 'PO Generation', number: '04A', href: '/dashboard/po/new', allowedRoles: [Role.Purchasing_Office] },
    { name: 'Check Release', number: '04B', href: '/dashboard/po/release-check', allowedRoles: [Role.Business_Office] },
    { name: 'Cargo Intake', number: '05', href: '/dashboard/receiving/new', allowedRoles: [Role.Receiving_Custodian] },
    { name: 'Audit Console', number: '06', href: '/dashboard/audit', allowedRoles: [Role.Global_Auditor] },
  ];

  // Filter navigation steps authorized for the active user's role
  const authorizedSteps = navigationSteps.filter((step) =>
    step.allowedRoles.includes(displayRole)
  );

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top Identity Bar */}
        <div className="flex items-center justify-between h-16">
          <Link href="/dashboard" className="flex items-center space-x-3 group">
            <div className="h-9 w-9 rounded-lg bg-emerald-700 flex items-center justify-center shadow-sm group-hover:bg-emerald-800 transition-colors">
              <span className="font-bold text-white text-xs tracking-tight">DMC</span>
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center space-x-2">
                <h1 className="text-sm font-bold tracking-tight text-slate-900">CPATS</h1>
                <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                  Session Active
                </span>
              </div>
              <p className="text-[11px] text-slate-400 -mt-0.5">
                Campus Procurement Automation &amp; Tracking System
              </p>
            </div>
          </Link>

          {/* User Session Info & Sign Out Button */}
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-2.5 pr-4 border-r border-slate-200">
              <div className="h-8 w-8 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <span className="text-xs font-bold text-emerald-700">{initial}</span>
              </div>
              <div className="text-left">
                <span className="block text-xs font-bold text-slate-800 leading-tight">{roleLabel}</span>
                <span className="block text-[11px] text-slate-400 leading-tight">{displayCode} Department</span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              disabled={signingOut}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg transition-colors disabled:opacity-50 active:scale-95 cursor-pointer"
            >
              {signingOut ? 'Signing out…' : 'Sign Out'}
            </button>
          </div>
        </div>

        {/* Workflow Stage Tabs */}
        {authorizedSteps.length > 1 && (
          <nav className="flex space-x-1.5 overflow-x-auto pb-3 no-scrollbar" aria-label="Procurement workflow stages">
            {authorizedSteps.map((step) => {
              const isActive = pathname === step.href;
              return (
                <Link
                  key={step.href}
                  href={step.href}
                  className={`whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold shadow-2xs'
                      : 'text-slate-500 border-transparent hover:text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <span className={`font-mono text-[10px] ${isActive ? 'text-emerald-600' : 'text-slate-300'}`}>
                    {step.number}
                  </span>
                  {step.name}
                </Link>
              );
            })}
          </nav>
        )}

      </div>
    </header>
  );
}